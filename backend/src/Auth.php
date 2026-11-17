<?php

declare(strict_types=1);

const TOKEN_LIFETIME_DAYS = 30;

/**
 * Bearer token from the Authorization header (case-insensitive scheme).
 */
function bearer_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/^Bearer\s+(\S+)$/i', (string) $header, $matches) === 1) {
        return $matches[1];
    }

    return null;
}

/**
 * Resolve the signed-in user from the bearer token, or null.
 */
function current_user(): ?array
{
    $token = bearer_token();
    if ($token === null) {
        return null;
    }

    $statement = db()->prepare(
        'SELECT u.* FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > ?'
    );
    $statement->execute([hash('sha256', $token), gmdate('Y-m-d H:i:s')]);
    $user = $statement->fetch();

    return $user ?: null;
}

/**
 * Stop the request unless a valid token was supplied.
 */
function require_user(): array
{
    $user = current_user();
    if ($user === null) {
        fail('Please sign in to continue.', 401);
    }

    return $user;
}

/**
 * Stop the request unless the signed-in user is an administrator.
 */
function require_admin(): array
{
    $user = require_user();
    if (($user['role'] ?? '') !== 'admin') {
        fail('This action requires an administrator account.', 403);
    }

    return $user;
}

/**
 * Create a new opaque session token and return the raw value (only the hash is stored).
 */
function issue_token(int $userId): string
{
    $token = bin2hex(random_bytes(32));
    $statement = db()->prepare(
        'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)'
    );
    $statement->execute([
        hash('sha256', $token),
        $userId,
        gmdate('Y-m-d H:i:s', time() + TOKEN_LIFETIME_DAYS * 86400),
    ]);

    return $token;
}

/**
 * Shape a user row for the frontend. Never leaks password_hash.
 */
function public_user(array $user): array
{
    return [
        'id' => (int) $user['id'],
        'name' => $user['name'],
        'email' => $user['email'],
        'role' => $user['role'],
        'contact' => $user['contact'],
        'avatar' => $user['avatar'] ?? '',
        'created_at' => $user['created_at'],
    ];
}
