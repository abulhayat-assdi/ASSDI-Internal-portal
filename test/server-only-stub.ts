// `server-only` throws on import outside a React Server Component, which
// would fail any unit test that touches a server-side module. Vitest aliases
// the package to this no-op so those modules can be tested directly.
export {};
