<?php

declare(strict_types=1);

/**
 * Optional AI integration (OpenAI-compatible chat completions).
 *
 * The app keeps working without an API key: every AI feature has a deterministic
 * fallback built from the real events and registrations in SQLite.
 */

const AI_HOURLY_LIMIT = 30;
const AI_RECOMMENDATION_TTL = 1800;

function ai_enabled(): bool
{
    if (env_value('AI_API_KEY') !== '') {
        return true;
    }

    // Local providers such as Ollama usually run without an API key.
    $base = env_value('AI_BASE_URL');

    return $base !== ''
        && preg_match('#^https?://(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:/|$)#i', $base) === 1;
}

function ai_base_url(): string
{
    return rtrim(env_value('AI_BASE_URL', 'https://api.openai.com/v1'), '/');
}

function ai_model(): string
{
    return env_value('AI_MODEL', 'gpt-4o-mini');
}

/**
 * POST JSON to an OpenAI-compatible endpoint. Returns null on any failure so the
 * caller can fall back to local logic.
 *
 * @param array<string, mixed> $payload
 * @return array<string, mixed>|null
 */
function ai_http_post(string $url, array $payload, string $apiKey): ?array
{
    $json = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        return null;
    }

    $timeout = max(5, min(60, (int) env_value('AI_TIMEOUT', '20')));

    if (function_exists('curl_init')) {
        $handle = curl_init($url);
        curl_setopt_array($handle, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $apiKey,
            ],
            CURLOPT_POSTFIELDS => $json,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_CONNECTTIMEOUT => min(10, $timeout),
        ]);
        $body = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
        $error = curl_error($handle);
        unset($handle);

        if ($body === false || $status < 200 || $status >= 300) {
            error_log('[event-app] AI request failed: status ' . $status . ' ' . $error);
            return null;
        }

        $decoded = json_decode((string) $body, true);

        return is_array($decoded) ? $decoded : null;
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\nAuthorization: Bearer " . $apiKey . "\r\n",
            'content' => $json,
            'timeout' => $timeout,
            'ignore_errors' => true,
        ],
    ]);

    $body = @file_get_contents($url, false, $context);
    $responseHeaders = function_exists('http_get_last_response_headers')
        ? (http_get_last_response_headers() ?: [])
        : ($http_response_header ?? []);
    if ($body === false) {
        error_log('[event-app] AI request failed: no response');
        return null;
    }

    $status = 0;
    if (isset($responseHeaders[0]) && preg_match('/\s(\d{3})\s/', $responseHeaders[0], $matches) === 1) {
        $status = (int) $matches[1];
    }
    if ($status < 200 || $status >= 300) {
        error_log('[event-app] AI request failed: status ' . $status);
        return null;
    }

    $decoded = json_decode($body, true);

    return is_array($decoded) ? $decoded : null;
}

/**
 * Send a chat conversation to the configured provider.
 *
 * @param array<int, array{role: string, content: string}> $messages
 */
function ai_chat(array $messages, float $temperature = 0.3, int $maxTokens = 500): ?string
{
    if (!ai_enabled()) {
        return null;
    }

    $response = ai_http_post(
        ai_base_url() . '/chat/completions',
        [
            'model' => ai_model(),
            'messages' => $messages,
            'temperature' => $temperature,
            'max_tokens' => $maxTokens,
        ],
        env_value('AI_API_KEY'),
    );

    $content = $response['choices'][0]['message']['content'] ?? null;
    if (!is_string($content) || trim($content) === '') {
        return null;
    }

    return trim($content);
}

/**
 * Extract a JSON object from a model reply, tolerating code fences and prose.
 *
 * @return array<string, mixed>|null
 */
function ai_parse_json(string $text): ?array
{
    $text = trim($text);
    if (preg_match('/```(?:json)?\s*(.+?)```/s', $text, $matches) === 1) {
        $text = trim($matches[1]);
    }

    $start = strpos($text, '{');
    $end = strrpos($text, '}');
    if ($start !== false && $end !== false && $end > $start) {
        $text = substr($text, $start, $end - $start + 1);
    }

    $data = json_decode($text, true);

    return is_array($data) ? $data : null;
}

/* -------------------------------------------------------------------------- */
/* Event data                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Upcoming events shaped like the /events API, including the current user's
 * registration id (null when not registered).
 */
function ai_upcoming_events(int $userId): array
{
    $statement = db()->prepare(
        "SELECT e.*,
            (SELECT COUNT(*) FROM registrations rc
                WHERE rc.event_id = e.id AND rc.status = 'registered') AS registered_count,
            (SELECT ru.id FROM registrations ru
                WHERE ru.event_id = e.id AND ru.user_id = ? AND ru.status = 'registered' LIMIT 1) AS registration_id
         FROM events e
         WHERE e.date >= ?
         ORDER BY e.date ASC, e.start_time ASC"
    );
    $statement->execute([$userId, date('Y-m-d')]);

    return array_map(static function (array $row): array {
        return [
            'id' => (int) $row['id'],
            'title' => $row['title'],
            'date' => $row['date'],
            'start_time' => $row['start_time'],
            'end_time' => $row['end_time'],
            'location' => $row['location'],
            'description' => $row['description'],
            'capacity' => (int) $row['capacity'],
            'registered_count' => (int) $row['registered_count'],
            'registration_id' => $row['registration_id'] === null ? null : (int) $row['registration_id'],
        ];
    }, $statement->fetchAll());
}

function ai_user_registrations(int $userId): array
{
    $statement = db()->prepare(
        "SELECT r.attendees, r.reference, r.status, e.id AS event_id, e.title, e.date,
                e.start_time, e.end_time, e.location, e.description
         FROM registrations r
         JOIN events e ON e.id = r.event_id
         WHERE r.user_id = ? AND r.status = 'registered'
         ORDER BY e.date ASC, e.start_time ASC"
    );
    $statement->execute([$userId]);

    return array_map(static function (array $row): array {
        return [
            'reference' => $row['reference'],
            'attendees' => (int) $row['attendees'],
            'event' => [
                'id' => (int) $row['event_id'],
                'title' => $row['title'],
                'date' => $row['date'],
                'start_time' => $row['start_time'],
                'end_time' => $row['end_time'],
                'location' => $row['location'],
                'description' => $row['description'],
            ],
        ];
    }, $statement->fetchAll());
}

/**
 * @param array<int, int> $ids
 */
function ai_saved_events(array $ids): array
{
    $ids = array_values(array_unique(array_filter(array_map('intval', $ids), static fn (int $id): bool => $id > 0)));
    if (!$ids) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $statement = db()->prepare(
        "SELECT id, title, date, start_time, end_time, location, description
         FROM events WHERE id IN ($placeholders) ORDER BY date ASC"
    );
    $statement->execute($ids);

    return array_map(static function (array $row): array {
        return [
            'id' => (int) $row['id'],
            'title' => $row['title'],
            'date' => $row['date'],
            'start_time' => $row['start_time'],
            'end_time' => $row['end_time'],
            'location' => $row['location'],
            'description' => $row['description'],
        ];
    }, $statement->fetchAll());
}

/**
 * @param array<int, int> $ids
 * @return array<int, int>
 */
function ai_normalized_ids(array $ids): array
{
    $ids = array_map('intval', $ids);
    $ids = array_filter($ids, static fn (int $id): bool => $id > 0);
    $ids = array_values(array_unique($ids));
    sort($ids);

    return $ids;
}

function ai_human_date(string $date): string
{
    $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date);

    return $parsed ? $parsed->format('M j, Y') : $date;
}

function ai_human_time(string $time): string
{
    $parsed = DateTimeImmutable::createFromFormat('!H:i', $time);

    return $parsed ? $parsed->format('g:i A') : $time;
}

function ai_spots_left(array $event): int
{
    return max(0, (int) $event['capacity'] - (int) $event['registered_count']);
}

/* -------------------------------------------------------------------------- */
/* Rate limiting                                                              */
/* -------------------------------------------------------------------------- */

function ai_take_quota(int $userId): bool
{
    $pdo = db();
    $pdo->prepare('DELETE FROM ai_requests WHERE created_at <= ?')
        ->execute([gmdate('Y-m-d H:i:s', time() - 3600)]);

    $count = $pdo->prepare('SELECT COUNT(*) FROM ai_requests WHERE user_id = ?');
    $count->execute([$userId]);

    if ((int) $count->fetchColumn() >= AI_HOURLY_LIMIT) {
        return false;
    }

    $pdo->prepare('INSERT INTO ai_requests (user_id) VALUES (?)')->execute([$userId]);

    return true;
}

/* -------------------------------------------------------------------------- */
/* Assistant                                                                  */
/* -------------------------------------------------------------------------- */

function ai_find_event(string $message, array $events): ?array
{
    $message = mb_strtolower($message);
    $best = null;
    $bestScore = 0;

    foreach ($events as $event) {
        $title = mb_strtolower($event['title']);
        $score = str_contains($message, $title) ? 100 : 0;

        if ($score === 0) {
            foreach (preg_split('/[^\p{L}\p{N}]+/u', $title) ?: [] as $word) {
                if (mb_strlen($word) >= 4 && str_contains($message, $word)) {
                    $score += 10;
                }
            }
        }

        if ($score > $bestScore) {
            $bestScore = $score;
            $best = $event;
        }
    }

    return $bestScore >= 10 ? $best : null;
}

function ai_registration_line(array $registration): string
{
    $event = $registration['event'];

    return '• ' . $event['title'] . ' — ' . ai_human_date($event['date'])
        . ', ' . ai_human_time($event['start_time']) . ' at ' . $event['location']
        . ' (ref ' . $registration['reference'] . ', '
        . $registration['attendees'] . ' attendee' . ($registration['attendees'] === 1 ? '' : 's') . ')';
}

/**
 * Deterministic replies used when no API key is configured or the provider fails.
 */
function ai_rule_reply(array $user, string $message, array $events, array $registrations): string
{
    $name = explode(' ', trim((string) $user['name']))[0] ?: 'there';
    $text = mb_strtolower($message);
    $mentioned = ai_find_event($message, $events);

    $asksRegistrations = preg_match('/\b(my|registrations?|tickets?|references?|bookings?)\b/i', $text) === 1;
    $asksCancel = preg_match('/\bcancel|refund|withdraw\b/i', $text) === 1;
    $asksLocation = preg_match('/\bwhere|location|venue|address\b/i', $text) === 1;
    $asksTime = preg_match('/\bwhen|date|time|schedule|upcoming|next|soon\b/i', $text) === 1;
    $asksHow = preg_match('/\bhow (do|can|to)|register|sign up|join\b/i', $text) === 1;
    $asksFree = preg_match('/\b(free|price|cost|fee|payment|pay)\b/i', $text) === 1;
    $greets = preg_match('/\b(hi|hello|hey|kumusta|good (morning|afternoon|evening))\b/i', $text) === 1;

    if ($asksCancel) {
        return "To cancel a registration, open My Events, choose the registration, then use Cancel registration. "
            . 'The seat is released immediately and the reference stays in your history.';
    }

    if ($asksRegistrations) {
        if (!$registrations) {
            return "You don't have any registrations yet, {$name}. Open an upcoming event and choose Register to join one.";
        }

        $lines = array_map('ai_registration_line', array_slice($registrations, 0, 4));
        $extra = count($registrations) > 4 ? "\n…and " . (count($registrations) - 4) . ' more in My Events.' : '';

        return "Here are your registrations, {$name}:\n" . implode("\n", $lines) . $extra;
    }

    if ($asksLocation) {
        if ($mentioned) {
            return $mentioned['title'] . ' is at ' . $mentioned['location'] . ' on '
                . ai_human_date($mentioned['date']) . ' from ' . ai_human_time($mentioned['start_time'])
                . ' to ' . ai_human_time($mentioned['end_time']) . '.';
        }

        $lines = array_map(
            static fn (array $event): string => '• ' . $event['title'] . ' — ' . $event['location'],
            array_slice($events, 0, 3),
        );

        return $lines
            ? "Here are the next venues:\n" . implode("\n", $lines)
            : 'There are no upcoming events with a venue yet.';
    }

    if ($asksTime) {
        if ($mentioned) {
            return $mentioned['title'] . ' is on ' . ai_human_date($mentioned['date']) . ' from '
                . ai_human_time($mentioned['start_time']) . ' to ' . ai_human_time($mentioned['end_time']) . '.';
        }

        if (!$events) {
            return 'There are no upcoming events right now. New events will appear on the Home page.';
        }

        $lines = array_map(
            static fn (array $event): string => '• ' . $event['title'] . ' — ' . ai_human_date($event['date'])
                . ', ' . ai_human_time($event['start_time']),
            array_slice($events, 0, 3),
        );

        return "Here is what's coming up:\n" . implode("\n", $lines);
    }

    if ($asksFree) {
        return 'All events in this demo are free. Choose an event, select Register, and your ticket reference is created instantly.';
    }

    if ($asksHow) {
        return 'Open Home or Register, pick an event, then choose Register. '
            . 'After submitting, your ticket reference appears in My Events. You can edit attendee details or cancel there.';
    }

    if ($greets) {
        $count = count($registrations);

        return "Hi {$name}! I can help with upcoming events, venues, schedules, and your registrations. "
            . ($count ? "You currently have {$count} registration" . ($count === 1 ? '' : 's') . ' on file.' : 'You have no registrations yet.');
    }

    if ($mentioned) {
        $spots = ai_spots_left($mentioned);
        $registered = $mentioned['registration_id'] !== null;
        $status = $registered
            ? 'You are already registered for this event.'
            : ($spots > 0 ? 'There are ' . $spots . ' spot' . ($spots === 1 ? '' : 's') . ' left.' : 'This event is full.');

        return $mentioned['title'] . ' is on ' . ai_human_date($mentioned['date']) . ' from '
            . ai_human_time($mentioned['start_time']) . ' to ' . ai_human_time($mentioned['end_time']) . ' at '
            . $mentioned['location'] . '. ' . $status;
    }

    if (!$events) {
        return 'There are no upcoming events right now. Check the Home page later for new listings.';
    }

    $lines = array_map(
        static fn (array $event): string => '• ' . $event['title'] . ' — ' . ai_human_date($event['date'])
            . ' at ' . $event['location'],
        array_slice($events, 0, 3),
    );

    return "Here are the next events, {$name}:\n" . implode("\n", $lines)
        . "\nAsk me about a date, venue, or your registration reference.";
}
function ai_is_in_scope(string $message): bool
{
    $text = strtolower(trim($message));

    if ($text === '') {
        return false;
    }

    // Allow greetings
    if (preg_match('/\b(hi|hello|hey|kumusta|good morning|good afternoon|good evening)\b/i', $text)) {
        return true;
    }

    // Block unrelated questions
    if (preg_match('/\b(generate|draw|image|picture|photo|joke|story|recipe|president|prime minister|news|weather|sports|song|lyrics)\b/i', $text)) {
        return false;
    }

    // Allow Event Registration System topics
    return preg_match('/\b(event|events|register|registration|registrations|ticket|tickets|booking|bookings|saved|save|profile|account|attendee|attendees|venue|location|schedule|upcoming|cancel|capacity|spot|spots|reference|dashboard|home page|system|app|feature|features|login|log in|sign in|password)\b/i', $text) === 1;
}


// CUSTOM CHATBOT RESPONSES
function ai_custom_reply(string $message): ?string
{
    $text = strtolower(trim($message));

    // Greeting
    if (preg_match('/^(hi|hello|hey|kumusta)[!. ]*$/i', $text)) {
        return 'Hello! Welcome to our Event Registration System. How can I help you today?';
    }

    // Asking for help
    if (preg_match('/^can you help me[?!. ]*$/i', $text)
        || preg_match('/^(help me|i need help)[?!. ]*$/i', $text)) {
        return 'Yes, of course! I can help you with upcoming events, event registration, saved events, schedules, and your account. What would you like to know?';
    }

    // Asking who the assistant is
    if (preg_match('/^(who are you|what are you)[?!. ]*$/i', $text)) {
        return 'I am your Event Registration Assistant. I can help you navigate and understand our system.';
    }

    // Thanks
    if (preg_match('/^(thanks|thank you|thank you so much)[!. ]*$/i', $text)) {
        return 'You are welcome! Feel free to ask me anything about our Event Registration System.';
    }

    return null;
}


// MAIN AI ANSWER FUNCTION
function ai_answer(array $user, string $message, array $history, array $savedIds): array
{
    // Check custom responses first
    $customReply = ai_custom_reply($message);

    if ($customReply !== null) {
        return [
            'reply' => $customReply,
            'mode' => 'rules',
        ];
    }

    // Check if the question is related to the system
    if (!ai_is_in_scope($message)) {
        return [
            'reply' => "I'm your Event Registration Assistant. I can only help with our event registration system, including events, schedules, registrations, saved events, and account features.",
            'mode' => 'rules',
        ];
    }
    $userId = (int) $user['id'];
    $events = ai_upcoming_events($userId);
    $registrations = ai_user_registrations($userId);
    $saved = ai_saved_events($savedIds);

    if (!ai_enabled()) {
        return ['reply' => ai_rule_reply($user, $message, $events, $registrations), 'mode' => 'rules'];
    }

    $context = [
        'today' => date('Y-m-d'),
        'user' => ['name' => $user['name'], 'role' => $user['role']],
        'upcoming_events' => array_map(static function (array $event): array {
            return [
                'event_id' => $event['id'],
                'title' => $event['title'],
                'date' => $event['date'],
                'start_time' => $event['start_time'],
                'end_time' => $event['end_time'],
                'location' => $event['location'],
                'description' => mb_substr($event['description'], 0, 220),
                'spots_left' => ai_spots_left($event),
                'you_are_registered' => $event['registration_id'] !== null,
            ];
        }, $events),
        'your_registrations' => $registrations,
        'saved_events' => array_map(
            static fn (array $event): array => ['title' => $event['title'], 'date' => $event['date']],
            $saved,
        ),
    ];

    $system = 'You are the Event Registration App assistant for a campus community. '
        . 'Answer only from the JSON data supplied. Be friendly, concise (under 90 words), and practical. '
        . 'Never invent events, dates, venues, prices, or reference numbers. All events are free in this demo. '
        . 'If something is not in the data, say you do not have that detail and point the user to My Events, Profile, or the event page. '
        . 'Use short lines or bullet points; do not use markdown tables. Today is ' . date('Y-m-d') . ".\n\n"
        . 'DATA: ' . json_encode($context, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    if (ai_take_quota($userId)) {
        $messages = [['role' => 'system', 'content' => $system]];
        foreach ($history as $entry) {
            $messages[] = $entry;
        }
        $messages[] = ['role' => 'user', 'content' => $message];

        $reply = ai_chat($messages, 0.35, 450);
        if ($reply !== null) {
            return ['reply' => mb_substr($reply, 0, 1600), 'mode' => 'ai'];
        }
    }

    return ['reply' => ai_rule_reply($user, $message, $events, $registrations), 'mode' => 'rules'];
}

/* -------------------------------------------------------------------------- */
/* Recommendations                                                            */
/* -------------------------------------------------------------------------- */

function ai_tokens(string $text): array
{
    $text = mb_strtolower($text);
    $parts = preg_split('/[^\p{L}\p{N}]+/u', $text) ?: [];
    $stop = [
        'event', 'events', 'with', 'from', 'this', 'that', 'your', 'have', 'will', 'join',
        'into', 'about', 'more', 'than', 'then', 'they', 'them', 'their', 'there', 'where',
        'when', 'what', 'which', 'while', 'would', 'could', 'should', 'after', 'before',
        'during', 'free', 'open', 'online', 'today', 'tomorrow', 'week', 'month', 'year',
        'community', 'student', 'students', 'campus', 'event\'s',
    ];

    $tokens = [];
    foreach ($parts as $part) {
        if (mb_strlen($part) >= 4 && !in_array($part, $stop, true)) {
            $tokens[$part] = true;
        }
    }

    return array_keys($tokens);
}

function ai_reason_for(array $event, array $registrations, array $saved, int $score, array $overlap): string
{
    $savedIds = array_column($saved, 'id');
    if (in_array($event['id'], $savedIds, true)) {
        return 'You saved this event.';
    }

    if ($overlap) {
        $label = implode(', ', array_slice($overlap, 0, 2));

        return 'Matches your interest in ' . $label . '.';
    }

    $days = (int) (new DateTimeImmutable('today'))->diff(new DateTimeImmutable($event['date']))->format('%r%a');
    if ($days >= 0 && $days <= 14) {
        return $days === 0 ? 'Happening today.' : 'Happening in ' . $days . ' day' . ($days === 1 ? '' : 's') . '.';
    }

    $spots = ai_spots_left($event);
    if ($spots > 0 && $spots <= 25) {
        return 'Only ' . $spots . ' spot' . ($spots === 1 ? '' : 's') . ' left.';
    }

    if (!$registrations) {
        return 'A good place to start on campus.';
    }

    return 'Fits the events you have joined.';
}

/**
 * @return array<int, array{event: array, reason: string}>
 */
function ai_rule_recommendations(array $candidates, array $registrations, array $saved, int $limit = 3): array
{
    $interestText = '';
    foreach ($registrations as $registration) {
        $interestText .= ' ' . $registration['event']['title'] . ' ' . $registration['event']['description'];
    }
    foreach ($saved as $event) {
        $interestText .= ' ' . $event['title'] . ' ' . $event['description'];
    }
    $interests = ai_tokens($interestText);

    $scored = [];
    foreach ($candidates as $event) {
        $overlap = array_values(array_intersect(ai_tokens($event['title'] . ' ' . $event['description']), $interests));
        $score = count($overlap) * 3;

        if (in_array($event['id'], array_column($saved, 'id'), true)) {
            $score += 8;
        }

        $days = (int) (new DateTimeImmutable('today'))->diff(new DateTimeImmutable($event['date']))->format('%r%a');
        if ($days >= 0 && $days <= 14) {
            $score += 4;
        } elseif ($days <= 30) {
            $score += 2;
        }

        $scored[] = [
            'event' => $event,
            'score' => $score,
            'overlap' => $overlap,
        ];
    }

    usort($scored, static function (array $a, array $b): int {
        return $b['score'] <=> $a['score'] ?: strcmp($a['event']['date'], $b['event']['date']);
    });

    return array_map(
        static fn (array $item): array => [
            'event' => $item['event'],
            'reason' => ai_reason_for($item['event'], $registrations, $saved, $item['score'], $item['overlap']),
        ],
        array_slice($scored, 0, $limit),
    );
}

/**
 * Ask the model to rank candidates. Returns null when the reply is unusable.
 *
 * @return array<int, array{event: array, reason: string}>|null
 */
function ai_model_recommendations(array $candidates, array $registrations, array $saved): ?array
{
    // Recommendations are cached, so they do not consume the assistant quota.
    if (!$candidates) {
        return null;
    }
    if (!ai_enabled()) {
        return null;
    }

    $interests = array_map(
        static fn (array $registration): string => $registration['event']['title'],
        $registrations,
    );
    foreach ($saved as $event) {
        $interests[] = $event['title'] . ' (saved)';
    }

    $payload = [
        'user_interests' => array_values(array_unique($interests)),
        'candidates' => array_map(static function (array $event): array {
            return [
                'event_id' => $event['id'],
                'title' => $event['title'],
                'date' => $event['date'],
                'location' => $event['location'],
                'description' => mb_substr($event['description'], 0, 180),
            ];
        }, $candidates),
    ];

    $system = 'You recommend campus events. Choose at most 3 candidates that best match the user\'s interests. '
        . 'Use only the supplied event_id values. Reply with strict JSON only: '
        . '{"recommendations":[{"event_id":1,"reason":"short reason under 14 words"}]}. '
        . 'Do not include events the user is already interested in unless the title clearly matches.';

    $reply = ai_chat(
        [
            ['role' => 'system', 'content' => $system],
            ['role' => 'user', 'content' => json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)],
        ],
        0.2,
        300,
    );
    if ($reply === null) {
        return null;
    }

    $data = ai_parse_json($reply);
    $rows = $data['recommendations'] ?? null;
    if (!is_array($rows)) {
        return null;
    }

    $byId = [];
    foreach ($candidates as $event) {
        $byId[$event['id']] = $event;
    }

    $items = [];
    $used = [];
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        $id = (int) ($row['event_id'] ?? 0);
        if (!isset($byId[$id]) || isset($used[$id])) {
            continue;
        }

        $reason = trim((string) ($row['reason'] ?? ''));
        $reason = trim(preg_replace('/\s+/', ' ', $reason) ?? '');
        if ($reason === '') {
            $reason = 'Recommended for you.';
        }

        $items[] = ['event' => $byId[$id], 'reason' => mb_substr($reason, 0, 140)];
        $used[$id] = true;
        if (count($items) === 3) {
            break;
        }
    }

    return $items ?: null;
}

function ai_cached_recommendations(int $userId, array $savedIds): ?array
{
    $statement = db()->prepare(
        'SELECT payload FROM ai_recommendations WHERE user_id = ? AND generated_at > ?'
    );
    $statement->execute([$userId, gmdate('Y-m-d H:i:s', time() - AI_RECOMMENDATION_TTL)]);
    $payload = $statement->fetchColumn();
    if (!is_string($payload) || $payload === '') {
        return null;
    }

    $data = json_decode($payload, true);
    if (!is_array($data)) {
        return null;
    }

    $cachedSaved = ai_normalized_ids(is_array($data['saved'] ?? null) ? $data['saved'] : []);
    if ($cachedSaved !== ai_normalized_ids($savedIds)) {
        return null;
    }

    return $data;
}

/**
 * @param array<int, array{id: int, reason: string}> $items
 * @param array<int, int> $savedIds
 */
function ai_store_recommendations(int $userId, array $items, string $mode, array $savedIds): void
{
    $payload = json_encode([
        'items' => $items,
        'mode' => $mode,
        'saved' => ai_normalized_ids($savedIds),
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($payload === false) {
        return;
    }

    $statement = db()->prepare(
        'INSERT INTO ai_recommendations (user_id, payload, generated_at) VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, generated_at = excluded.generated_at'
    );
    $statement->execute([$userId, $payload, gmdate('Y-m-d H:i:s')]);
}

/**
 * @param array<int, int> $savedIds
 * @return array{items: array<int, array{event: array, reason: string}>, mode: string}
 */
function ai_recommendations_for(int $userId, array $savedIds): array
{
    $events = ai_upcoming_events($userId);
    $candidates = array_values(array_filter(
        $events,
        static fn (array $event): bool => $event['registration_id'] === null,
    ));

    if (!$candidates) {
        return ['items' => [], 'mode' => 'rules'];
    }

    $byId = [];
    foreach ($candidates as $event) {
        $byId[$event['id']] = $event;
    }

    $saved = ai_saved_events($savedIds);

    $cached = ai_cached_recommendations($userId, $savedIds);
    if ($cached !== null && isset($cached['items']) && is_array($cached['items'])) {
        $items = [];
        foreach ($cached['items'] as $item) {
            $id = (int) ($item['id'] ?? 0);
            if (isset($byId[$id])) {
                $items[] = [
                    'event' => $byId[$id],
                    'reason' => (string) ($item['reason'] ?? 'Recommended for you.'),
                ];
            }
            if (count($items) === 3) {
                break;
            }
        }
        if ($items) {
            return ['items' => $items, 'mode' => (string) ($cached['mode'] ?? 'rules')];
        }
    }

    $registrations = ai_user_registrations($userId);

    $items = ai_rule_recommendations($candidates, $registrations, $saved, 3);
    $mode = 'rules';

    if (ai_enabled()) {
        $modelItems = ai_model_recommendations($candidates, $registrations, $saved);
        if ($modelItems !== null) {
            $used = array_column($modelItems, 'event');
            $usedIds = array_map(static fn (array $event): int => (int) $event['id'], $used);
            foreach (ai_rule_recommendations($candidates, $registrations, $saved, 3) as $fallback) {
                if (count($modelItems) >= 3) {
                    break;
                }
                if (!in_array((int) $fallback['event']['id'], $usedIds, true)) {
                    $modelItems[] = $fallback;
                    $usedIds[] = (int) $fallback['event']['id'];
                }
            }
            $items = $modelItems;
            $mode = 'ai';
        }
    }

    $cacheItems = array_map(
        static fn (array $item): array => [
            'id' => (int) $item['event']['id'],
            'reason' => (string) $item['reason'],
        ],
        $items,
    );
    ai_store_recommendations($userId, $cacheItems, $mode, $savedIds);

    return ['items' => $items, 'mode' => $mode];
}
