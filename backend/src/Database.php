<?php

declare(strict_types=1);

/**
 * SQLite connection, schema and demo data.
 *
 * The file lives in backend/storage/app.sqlite and is created automatically the
 * first time the API is called.
 */

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    // Use Railway database path if configured.
    // Otherwise, use the local SQLite database.
    $databasePath = getenv('DB_PATH');

    if (!$databasePath) {
        $databasePath = dirname(__DIR__)
            . DIRECTORY_SEPARATOR . 'storage'
            . DIRECTORY_SEPARATOR . 'app.sqlite';
    }

    $storage = dirname($databasePath);

    if (
        !is_dir($storage) &&
        !mkdir($storage, 0777, true) &&
        !is_dir($storage)
    ) {
        throw new RuntimeException('Could not create the storage directory.');
    }

    $pdo = new PDO('sqlite:' . $databasePath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec('PRAGMA journal_mode = WAL');

    migrate($pdo);
    seed($pdo);

    return $pdo;
}


function migrate(PDO $pdo): void
{
    $pdo->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            name          TEXT NOT NULL,
            email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            role          TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
            contact       TEXT NOT NULL DEFAULT '',
            avatar        TEXT NOT NULL DEFAULT '',
            created_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY,
            user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS events (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT NOT NULL,
            date        TEXT NOT NULL,
            start_time  TEXT NOT NULL,
            end_time    TEXT NOT NULL,
            location    TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            capacity    INTEGER NOT NULL DEFAULT 100,
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS registrations (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
            full_name  TEXT NOT NULL,
            email      TEXT NOT NULL,
            contact    TEXT NOT NULL,
            attendees  INTEGER NOT NULL DEFAULT 1,
            reference  TEXT NOT NULL UNIQUE,
            status     TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'cancelled')),
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT,
            UNIQUE (user_id, event_id)
        );

        CREATE TABLE IF NOT EXISTS ai_requests (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS ai_recommendations (
            user_id      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            payload      TEXT NOT NULL,
            generated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
        CREATE INDEX IF NOT EXISTS idx_registrations_user ON registrations(user_id, status);
        CREATE INDEX IF NOT EXISTS idx_registrations_event ON registrations(event_id, status);
        CREATE INDEX IF NOT EXISTS idx_ai_requests_user ON ai_requests(user_id, created_at);
    SQL);
}

function seed(PDO $pdo): void
{
    $count = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
    if ($count > 0) {
        return;
    }

    $today = new DateTimeImmutable('today');
    $day = static fn (int $offset): string => $today->modify(($offset >= 0 ? '+' : '') . $offset . ' days')->format('Y-m-d');

    $students = [
        [
            'name' => 'Alex Santos',
            'email' => 'alex.santos@email.com',
            'password' => 'Password123',
            'role' => 'student',
            'contact' => '+63 900 000 0000',
        ],
        [
            'name' => 'Admin User',
            'email' => 'admin@eventapp.test',
            'password' => 'Admin123',
            'role' => 'admin',
            'contact' => '+63 917 555 0100',
        ],
    ];

    $insertUser = $pdo->prepare(
        'INSERT INTO users (name, email, password_hash, role, contact) VALUES (?, ?, ?, ?, ?)'
    );
    foreach ($students as $student) {
        $insertUser->execute([
            $student['name'],
            $student['email'],
            password_hash($student['password'], PASSWORD_DEFAULT),
            $student['role'],
            $student['contact'],
        ]);
    }

    $events = [
        [
            'title' => 'Tech Summit 2026',
            'date' => $day(-15),
            'start_time' => '09:00',
            'end_time' => '17:00',
            'location' => 'Main Hall, City Campus',
            'description' => 'A full day of talks, demos and workshops on software, AI and product design.',
            'capacity' => 250,
        ],
        [
            'title' => 'Student Career Fair',
            'date' => $day(6),
            'start_time' => '08:00',
            'end_time' => '16:00',
            'location' => 'University Gym',
            'description' => 'Meet recruiters from over 40 companies and explore internships and graduate roles.',
            'capacity' => 300,
        ],
        [
            'title' => 'Community Outreach',
            'date' => $day(26),
            'start_time' => '08:00',
            'end_time' => '12:00',
            'location' => 'Brgy. Central Park',
            'description' => 'Spend the morning volunteering with local partners for a cleaner, greener community.',
            'capacity' => 120,
        ],
        [
            'title' => 'Campus Hackathon 2027',
            'date' => $day(45),
            'start_time' => '09:00',
            'end_time' => '21:00',
            'location' => 'Innovation Hub',
            'description' => 'Build something useful in 12 hours. Open to all students, beginners welcome.',
            'capacity' => 100,
        ],
        [
            'title' => 'Leadership Summit',
            'date' => $day(70),
            'start_time' => '10:00',
            'end_time' => '15:00',
            'location' => 'Auditorium',
            'description' => 'Student leaders share playbooks for running clubs, teams and community projects.',
            'capacity' => 180,
        ],
    ];

    $insertEvent = $pdo->prepare(
        'INSERT INTO events (title, date, start_time, end_time, location, description, capacity)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    foreach ($events as $event) {
        $insertEvent->execute([
            $event['title'],
            $event['date'],
            $event['start_time'],
            $event['end_time'],
            $event['location'],
            $event['description'],
            $event['capacity'],
        ]);
    }

    // Give the demo student a realistic mixture of upcoming and past registrations.
    $alex = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $alex->execute(['alex.santos@email.com']);
    $alexId = (int) $alex->fetchColumn();

    $eventId = $pdo->prepare('SELECT id FROM events WHERE title = ?');
    $registrations = [
        ['Tech Summit 2026', 'TS26-0142', 2],
        ['Community Outreach', 'CO26-0087', 1],
        ['Campus Hackathon 2027', 'CA27-0031', 3],
    ];

    $insertRegistration = $pdo->prepare(
        'INSERT INTO registrations (user_id, event_id, full_name, email, contact, attendees, reference)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    foreach ($registrations as [$title, $reference, $attendees]) {
    $eventId->execute([$title]);
    $id = (int) $eventId->fetchColumn();

    if ($id > 0) {
        $insertRegistration->execute([
            $alexId,
            $id,
            'Alex Santos',
            'alex.santos@email.com',
            '+63 900 000 0000',
            $attendees,
            $reference,
        ]);
    }
}
}
