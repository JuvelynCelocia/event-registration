<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/Http.php';
require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/Auth.php';
require_once __DIR__ . '/../src/Env.php';
require_once __DIR__ . '/../src/Ai.php';

date_default_timezone_set('Asia/Manila');
load_env(__DIR__ . '/../.env');

send_cors_headers();

if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
if (str_starts_with($path, '/api')) {
    $path = substr($path, 4);
}
$path = rtrim($path, '/');
if ($path === '') {
    $path = '/';
}

try {
    dispatch(strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'), $path);
} catch (Throwable $exception) {
    error_log('[event-app] ' . $exception->getMessage() . ' @ ' . $exception->getFile() . ':' . $exception->getLine());
    fail('Something went wrong on the server. Please try again.', 500);
}

function dispatch(string $method, string $path): never
{
    /* ---------------------------------------------------------------- auth */

    if ($method === 'POST' && $path === '/auth/login') {
        login_user();
    }
    if ($method === 'POST' && $path === '/auth/register') {
        register_user();
    }
    if ($method === 'POST' && $path === '/auth/logout') {
        logout_user();
    }
    if ($method === 'GET' && $path === '/auth/me') {
        json_response(['user' => public_user(require_user())]);
    }

    /* -------------------------------------------------------------- profile */

    if ($method === 'PUT' && $path === '/me') {
        update_me();
    }
    if ($method === 'PUT' && $path === '/me/password') {
        change_password();
    }

    /* --------------------------------------------------------------- events */

    if ($method === 'GET' && $path === '/events') {
        list_events();
    }
    if ($method === 'POST' && $path === '/events') {
        create_event();
    }
    if (preg_match('#^/events/(\d+)$#', $path, $matches) === 1) {
        $eventId = (int) $matches[1];
        if ($method === 'GET') {
            show_event($eventId);
        }
        if ($method === 'PUT') {
            update_event($eventId);
        }
        if ($method === 'DELETE') {
            delete_event($eventId);
        }
    }

    /* -------------------------------------------------------- registrations */

    if ($method === 'GET' && $path === '/registrations') {
        list_registrations();
    }
    if ($method === 'POST' && $path === '/registrations') {
        create_registration();
    }
    if (preg_match('#^/registrations/(\d+)$#', $path, $matches) === 1) {
        $registrationId = (int) $matches[1];
        if ($method === 'GET') {
            show_registration($registrationId);
        }
        if ($method === 'PUT') {
            update_registration($registrationId);
        }
        if ($method === 'DELETE') {
            cancel_registration($registrationId);
        }
    }

    /* ------------------------------------------------------------------- ai */

    if ($method === 'POST' && $path === '/ai/assistant') {
        ai_assistant();
    }
    if ($method === 'GET' && $path === '/ai/recommendations') {
        ai_recommendations();
    }

    fail('Not found.', 404);
}

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

function login_user(): never
{
    $data = request_body();
    $email = trim((string) ($data['email'] ?? ''));
    $password = (string) ($data['password'] ?? '');

    $errors = [];
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors['email'] = 'Enter a valid email address.';
    }
    if ($password === '') {
        $errors['password'] = 'Enter your password.';
    }
    if ($errors) {
        fail('Please check your details and try again.', 422, $errors);
    }

    $statement = db()->prepare('SELECT * FROM users WHERE email = ?');
    $statement->execute([$email]);
    $user = $statement->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        fail('Incorrect email or password.', 401);
    }

    db()->exec("DELETE FROM sessions WHERE expires_at <= '" . gmdate('Y-m-d H:i:s') . "'");
    $token = issue_token((int) $user['id']);

    json_response(['token' => $token, 'user' => public_user($user)]);
}

function register_user(): never
{
    $data = request_body();

    $name = string_value($data, 'name', 'Full name', 120);
    if (mb_strlen($name) < 2) {
        fail('Enter your full name.', 422, ['name' => 'Enter your full name.']);
    }
    $email = validate_email($data);
    $password = (string) ($data['password'] ?? '');
    if (strlen($password) < 6) {
        fail('Password must be at least 6 characters.', 422, ['password' => 'Password must be at least 6 characters.']);
    }

    $exists = db()->prepare('SELECT id FROM users WHERE email = ?');
    $exists->execute([$email]);
    if ($exists->fetch()) {
        fail('An account with that email already exists.', 422, ['email' => 'An account with that email already exists.']);
    }

    $statement = db()->prepare(
        "INSERT INTO users (name, email, password_hash, role, contact) VALUES (?, ?, ?, 'student', '')"
    );
    $statement->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT)]);

    $userId = (int) db()->lastInsertId();
    $userStatement = db()->prepare('SELECT * FROM users WHERE id = ?');
    $userStatement->execute([$userId]);
    $user = $userStatement->fetch();

    json_response([
        'token' => issue_token($userId),
        'user' => public_user($user),
    ], 201);
}

function logout_user(): never
{
    $token = bearer_token();
    if ($token !== null) {
        $statement = db()->prepare('DELETE FROM sessions WHERE token_hash = ?');
        $statement->execute([hash('sha256', $token)]);
    }

    json_response(['message' => 'You have been signed out.']);
}

/* -------------------------------------------------------------------------- */
/* Profile                                                                    */
/* -------------------------------------------------------------------------- */

function update_me(): never
{
    $user = require_user();
    $data = request_body();

    $name = string_value($data, 'name', 'Full name', 120);
    $email = validate_email($data);
    $contact = optional_string($data, 'contact', 60);
    $avatar = array_key_exists('avatar', $data)
        ? trim((string) $data['avatar'])
        : (string) ($user['avatar'] ?? '');

    $errors = [];
    if ($avatar !== '') {
        if (!preg_match('#^data:image/(png|jpe?g|webp);base64,#i', $avatar)) {
            $errors['avatar'] = 'Use a PNG, JPG or WebP image.';
        } elseif (strlen($avatar) > 700_000) {
            $errors['avatar'] = 'That image is too large. Choose a smaller one.';
        }
    }
    if ($errors) {
        fail('Please check your details.', 422, $errors);
    }

    $duplicate = db()->prepare('SELECT id FROM users WHERE email = ? AND id <> ?');
    $duplicate->execute([$email, $user['id']]);
    if ($duplicate->fetch()) {
        fail('That email is already in use.', 422, ['email' => 'That email is already in use.']);
    }

    $statement = db()->prepare('UPDATE users SET name = ?, email = ?, contact = ?, avatar = ? WHERE id = ?');
    $statement->execute([$name, $email, $contact, $avatar, $user['id']]);

    $fresh = db()->prepare('SELECT * FROM users WHERE id = ?');
    $fresh->execute([$user['id']]);

    json_response(['user' => public_user($fresh->fetch())]);
}

function change_password(): never
{
    $user = require_user();
    $data = request_body();

    $current = (string) ($data['current_password'] ?? '');
    $new = (string) ($data['new_password'] ?? '');

    if (!password_verify($current, $user['password_hash'])) {
        fail('Your current password is incorrect.', 422, ['current_password' => 'Your current password is incorrect.']);
    }
    if (strlen($new) < 6) {
        fail('New password must be at least 6 characters.', 422, ['new_password' => 'Use at least 6 characters.']);
    }
    if ($current === $new) {
        fail('Choose a password you have not used before.', 422, ['new_password' => 'Choose a different password.']);
    }

    $statement = db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    $statement->execute([password_hash($new, PASSWORD_DEFAULT), $user['id']]);

    json_response(['message' => 'Your password has been updated.']);
}

/* -------------------------------------------------------------------------- */
/* Events                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * @return array{title: string, date: string, start_time: string, end_time: string, location: string, description: string, capacity: int}
 */
function validated_event_input(): array
{
    $data = request_body();

    $title = string_value($data, 'title', 'Event title', 160);

    $date = trim((string) ($data['date'] ?? ''));
    $parsedDate = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
    if (!$parsedDate || $parsedDate->format('Y-m-d') !== $date) {
        fail('Enter a valid date.', 422, ['date' => 'Enter a valid date.']);
    }

    $start = normalize_time($data['start_time'] ?? '', 'start_time', 'Start time');
    $end = normalize_time($data['end_time'] ?? '', 'end_time', 'End time');
    if ($end <= $start) {
        fail('End time must be after the start time.', 422, ['end_time' => 'End time must be after the start time.']);
    }

    $location = string_value($data, 'location', 'Location', 190);
    $description = optional_string($data, 'description', 2000);
    $capacity = int_value($data, 'capacity', 1, 10000, 'Capacity');

    return [
        'title' => $title,
        'date' => $date,
        'start_time' => $start,
        'end_time' => $end,
        'location' => $location,
        'description' => $description,
        'capacity' => $capacity,
    ];
}

/**
 * @param mixed $value
 */
function normalize_time(mixed $value, string $key, string $label): string
{
    $value = trim((string) $value);
    if (preg_match('/^(\d{1,2}):(\d{2})(?::\d{2})?$/', $value, $matches) === 1) {
        $hours = (int) $matches[1];
        $minutes = (int) $matches[2];
        if ($hours <= 23 && $minutes <= 59) {
            return sprintf('%02d:%02d', $hours, $minutes);
        }
    }

    fail($label . ' must be a time such as 09:00.', 422, [$key => 'Use a time such as 09:00.']);
}

function event_select_sql(): string
{
    return "SELECT e.*,
        (SELECT COUNT(*) FROM registrations rc
            WHERE rc.event_id = e.id AND rc.status = 'registered') AS registered_count,
        (SELECT ru.id FROM registrations ru
            WHERE ru.event_id = e.id AND ru.user_id = ? AND ru.status = 'registered' LIMIT 1) AS registration_id
        FROM events e";
}

function shape_event(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'title' => $row['title'],
        'date' => $row['date'],
        'start_time' => $row['start_time'],
        'end_time' => $row['end_time'],
        'location' => $row['location'],
        'description' => $row['description'],
        'capacity' => (int) $row['capacity'],
        'registered_count' => (int) ($row['registered_count'] ?? 0),
        'registration_id' => isset($row['registration_id']) ? (int) $row['registration_id'] : null,
        'created_at' => $row['created_at'],
    ];
}

function find_event(int $id): ?array
{
    $statement = db()->prepare('SELECT * FROM events WHERE id = ?');
    $statement->execute([$id]);
    $event = $statement->fetch();

    return $event ?: null;
}

function event_for_user(int $id, int $userId = 0): ?array
{
    $statement = db()->prepare(event_select_sql() . ' WHERE e.id = ?');
    $statement->execute([$userId, $id]);
    $event = $statement->fetch();

    return $event ? shape_event($event) : null;
}

function list_events(): never
{
    $user = current_user();
    $userId = $user ? (int) $user['id'] : 0;
    $search = trim((string) ($_GET['search'] ?? ''));
    $scope = (string) ($_GET['scope'] ?? 'all');

    $where = [];
    $params = [$userId];

    if ($search !== '') {
        $where[] = '(e.title LIKE ? OR e.location LIKE ? OR e.description LIKE ?)';
        $like = '%' . $search . '%';
        array_push($params, $like, $like, $like);
    }
    if ($scope === 'upcoming') {
        $where[] = 'e.date >= ?';
        $params[] = date('Y-m-d');
    } elseif ($scope === 'past') {
        $where[] = 'e.date < ?';
        $params[] = date('Y-m-d');
    }

    $sql = event_select_sql();
    if ($where) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    $sql .= ' ORDER BY e.date ASC, e.start_time ASC';

    $statement = db()->prepare($sql);
    $statement->execute($params);

    json_response(['events' => array_map('shape_event', $statement->fetchAll())]);
}

function show_event(int $id): never
{
    $user = current_user();
    $event = event_for_user($id, $user ? (int) $user['id'] : 0);
    if ($event === null) {
        fail('Event not found.', 404);
    }

    json_response(['event' => $event]);
}

function create_event(): never
{
    require_admin();
    $input = validated_event_input();

    $statement = db()->prepare(
        'INSERT INTO events (title, date, start_time, end_time, location, description, capacity)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $statement->execute([
        $input['title'],
        $input['date'],
        $input['start_time'],
        $input['end_time'],
        $input['location'],
        $input['description'],
        $input['capacity'],
    ]);

    json_response(['event' => event_for_user((int) db()->lastInsertId())], 201);
}

function update_event(int $id): never
{
    $admin = require_admin();
    if (find_event($id) === null) {
        fail('Event not found.', 404);
    }
    $input = validated_event_input();

    $statement = db()->prepare(
        'UPDATE events SET title = ?, date = ?, start_time = ?, end_time = ?, location = ?, description = ?, capacity = ?
         WHERE id = ?'
    );
    $statement->execute([
        $input['title'],
        $input['date'],
        $input['start_time'],
        $input['end_time'],
        $input['location'],
        $input['description'],
        $input['capacity'],
        $id,
    ]);

    json_response(['event' => event_for_user($id, (int) $admin['id'])]);
}

function delete_event(int $id): never
{
    require_admin();
    if (find_event($id) === null) {
        fail('Event not found.', 404);
    }

    $statement = db()->prepare('DELETE FROM events WHERE id = ?');
    $statement->execute([$id]);

    json_response(['message' => 'Event deleted.']);
}

/* -------------------------------------------------------------------------- */
/* Registrations                                                              */
/* -------------------------------------------------------------------------- */

function registration_query(): string
{
    return 'SELECT r.*, e.title, e.date, e.start_time, e.end_time, e.location, e.description, e.capacity
            FROM registrations r
            JOIN events e ON e.id = r.event_id';
}

function find_registration(int $id): ?array
{
    $statement = db()->prepare(registration_query() . ' WHERE r.id = ?');
    $statement->execute([$id]);
    $row = $statement->fetch();

    return $row ?: null;
}

function shape_registration(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'full_name' => $row['full_name'],
        'email' => $row['email'],
        'contact' => $row['contact'],
        'attendees' => (int) $row['attendees'],
        'reference' => $row['reference'],
        'status' => $row['status'],
        'created_at' => $row['created_at'],
        'updated_at' => $row['updated_at'],
        'event' => [
            'id' => (int) $row['event_id'],
            'title' => $row['title'],
            'date' => $row['date'],
            'start_time' => $row['start_time'],
            'end_time' => $row['end_time'],
            'location' => $row['location'],
            'description' => $row['description'],
            'capacity' => (int) $row['capacity'],
        ],
    ];
}

function can_manage_registration(array $registration, array $user): bool
{
    return (int) $registration['user_id'] === (int) $user['id'] || $user['role'] === 'admin';
}

function list_registrations(): never
{
    $user = require_user();
    $scope = (string) ($_GET['scope'] ?? 'all');

    $sql = registration_query() . " WHERE r.user_id = ? AND r.status = 'registered'";
    $params = [(int) $user['id']];

    if ($scope === 'upcoming') {
        $sql .= ' AND e.date >= ?';
        $params[] = date('Y-m-d');
    } elseif ($scope === 'past') {
        $sql .= ' AND e.date < ?';
        $params[] = date('Y-m-d');
    }
    $sql .= ' ORDER BY e.date ASC, e.start_time ASC';

    $statement = db()->prepare($sql);
    $statement->execute($params);

    json_response(['registrations' => array_map('shape_registration', $statement->fetchAll())]);
}

function show_registration(int $id): never
{
    $user = require_user();
    $registration = find_registration($id);
    if ($registration === null) {
        fail('Registration not found.', 404);
    }
    if (!can_manage_registration($registration, $user)) {
        fail('You do not have access to that registration.', 403);
    }

    json_response(['registration' => shape_registration($registration)]);
}

function make_reference(string $title, string $date): string
{
    $words = preg_split('/[^A-Za-z0-9]+/', $title, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    $prefix = '';
    foreach ($words as $word) {
        $prefix .= strtoupper($word[0]);
        if (strlen($prefix) >= 2) {
            break;
        }
    }
    if (strlen($prefix) < 2) {
        $clean = strtoupper((string) preg_replace('/[^A-Za-z]/', '', $title));
        $prefix = str_pad(substr($clean, 0, 2), 2, 'X');
    }

    $year = substr($date, 2, 2);
    $check = db()->prepare('SELECT 1 FROM registrations WHERE reference = ?');

    for ($attempt = 0; $attempt < 40; $attempt++) {
        $reference = $prefix . $year . '-' . str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
        $check->execute([$reference]);
        if (!$check->fetchColumn()) {
            return $reference;
        }
    }

    return $prefix . $year . '-' . strtoupper(bin2hex(random_bytes(3)));
}

function create_registration(): never
{
    $user = require_user();
    $data = request_body();

    $eventId = int_value($data, 'event_id', 1, PHP_INT_MAX, 'Event');
    $fullName = string_value($data, 'full_name', 'Full name', 160);
    $email = validate_email($data);
    $contact = string_value($data, 'contact', 'Contact number', 60);
    $attendees = int_value($data, 'attendees', 1, 10, 'Number of attendees');

    $event = find_event($eventId);
    if ($event === null) {
        fail('Event not found.', 404);
    }
    if ($event['date'] < date('Y-m-d')) {
        fail('This event has already taken place.', 422, ['event_id' => 'This event has already taken place.']);
    }

    $takenStatement = db()->prepare(
        "SELECT COALESCE(SUM(attendees), 0) FROM registrations WHERE event_id = ? AND status = 'registered'"
    );
    $takenStatement->execute([$eventId]);
    $taken = (int) $takenStatement->fetchColumn();
    if ($taken + $attendees > (int) $event['capacity']) {
        fail('There are not enough spots left for that many attendees.', 422, ['attendees' => 'Not enough spots remain.']);
    }

    $existingStatement = db()->prepare('SELECT * FROM registrations WHERE user_id = ? AND event_id = ?');
    $existingStatement->execute([$user['id'], $eventId]);
    $existing = $existingStatement->fetch();

    $values = [$fullName, $email, $contact, $attendees];

    if ($existing && $existing['status'] === 'registered') {
        fail('You are already registered for this event.', 409);
    }

    if ($existing) {
        $reference = $existing['reference'];
        $statement = db()->prepare(
            "UPDATE registrations
             SET full_name = ?, email = ?, contact = ?, attendees = ?, status = 'registered', updated_at = datetime('now')
             WHERE id = ?"
        );
        $statement->execute([...$values, $existing['id']]);
        $registrationId = (int) $existing['id'];
    } else {
        $reference = make_reference($event['title'], $event['date']);
        $statement = db()->prepare(
            'INSERT INTO registrations (user_id, event_id, full_name, email, contact, attendees, reference)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $statement->execute([$user['id'], $eventId, ...$values, $reference]);
        $registrationId = (int) db()->lastInsertId();
    }

    json_response([
        'registration' => shape_registration(find_registration($registrationId)),
    ], 201);
}

function update_registration(int $id): never
{
    $user = require_user();
    $registration = find_registration($id);
    if ($registration === null) {
        fail('Registration not found.', 404);
    }
    if (!can_manage_registration($registration, $user)) {
        fail('You do not have access to that registration.', 403);
    }
    if ($registration['status'] !== 'registered') {
        fail('This registration has already been cancelled.', 409);
    }

    $data = request_body();
    $fullName = string_value($data, 'full_name', 'Full name', 160);
    $email = validate_email($data);
    $contact = string_value($data, 'contact', 'Contact number', 60);
    $attendees = int_value($data, 'attendees', 1, 10, 'Number of attendees');

    $takenStatement = db()->prepare(
        "SELECT COALESCE(SUM(attendees), 0) FROM registrations
         WHERE event_id = ? AND status = 'registered' AND id <> ?"
    );
    $takenStatement->execute([$registration['event_id'], $id]);
    $taken = (int) $takenStatement->fetchColumn();
    if ($taken + $attendees > (int) $registration['capacity']) {
        fail('There are not enough spots left for that many attendees.', 422, ['attendees' => 'Not enough spots remain.']);
    }

    $statement = db()->prepare(
        "UPDATE registrations
         SET full_name = ?, email = ?, contact = ?, attendees = ?, updated_at = datetime('now')
         WHERE id = ?"
    );
    $statement->execute([$fullName, $email, $contact, $attendees, $id]);

    json_response(['registration' => shape_registration(find_registration($id))]);
}

function cancel_registration(int $id): never
{
    $user = require_user();
    $registration = find_registration($id);
    if ($registration === null) {
        fail('Registration not found.', 404);
    }
    if (!can_manage_registration($registration, $user)) {
        fail('You do not have access to that registration.', 403);
    }

    if ($registration['status'] === 'registered') {
        $statement = db()->prepare(
            "UPDATE registrations SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?"
        );
        $statement->execute([$id]);
    }

    json_response(['message' => 'Your registration has been cancelled.']);
}

/* -------------------------------------------------------------------------- */
/* AI                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Normalise saved event ids from JSON or a comma-separated query string.
 *
 * @return array<int, int>
 */
function parse_saved_ids(mixed $raw): array
{
    if (is_string($raw)) {
        $raw = explode(',', $raw);
    }
    if (!is_array($raw)) {
        return [];
    }

    $ids = [];
    foreach (array_slice($raw, 0, 50) as $value) {
        $id = (int) $value;
        if ($id > 0) {
            $ids[$id] = true;
        }
    }

    return array_map('intval', array_keys($ids));
}

/**
 * @return array<int, array{role: string, content: string}>
 */
function parse_ai_history(mixed $raw): array
{
    if (!is_array($raw)) {
        return [];
    }

    $history = [];
    foreach (array_slice($raw, -8) as $entry) {
        if (!is_array($entry)) {
            continue;
        }
        $role = (string) ($entry['role'] ?? '');
        $content = trim((string) ($entry['content'] ?? ''));
        if (($role === 'user' || $role === 'assistant') && $content !== '') {
            $history[] = ['role' => $role, 'content' => mb_substr($content, 0, 1200)];
        }
    }

    return $history;
}

function ai_assistant(): never
{
    $user = require_user();
    $data = request_body();

    $message = trim((string) ($data['message'] ?? ''));
    if ($message === '') {
        fail('Type a message first.', 422, ['message' => 'Type a message first.']);
    }
    if (mb_strlen($message) > 1000) {
        fail('That message is too long.', 422, ['message' => 'Use 1,000 characters or fewer.']);
    }

    $result = ai_answer(
        $user,
        $message,
        parse_ai_history($data['history'] ?? []),
        parse_saved_ids($data['saved_event_ids'] ?? []),
    );

    json_response([
        'reply' => $result['reply'],
        'mode' => $result['mode'],
        'ai' => ai_enabled(),
    ]);
}

function ai_recommendations(): never
{
    $user = require_user();
    $result = ai_recommendations_for((int) $user['id'], parse_saved_ids($_GET['saved'] ?? []));

    json_response([
        'items' => $result['items'],
        'mode' => $result['mode'],
        'ai' => ai_enabled(),
    ]);
}
