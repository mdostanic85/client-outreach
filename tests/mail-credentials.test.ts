import assert from "node:assert/strict";
import {
  buildMailCredentialsFromEnv,
  MAIL_PROVIDER_PRESETS,
  resolveMailEndpoints,
  resolveMailProvider,
} from "../src/modules/mail/credentials";

assert.equal(resolveMailProvider(undefined), "gmail");
assert.equal(resolveMailProvider("FastMail"), "fastmail");
assert.equal(resolveMailProvider("outlook"), "outlook");
assert.equal(resolveMailProvider("custom"), "custom");
assert.equal(resolveMailProvider("nope"), "gmail");

assert.deepEqual(
  resolveMailEndpoints("gmail"),
  MAIL_PROVIDER_PRESETS.gmail,
);
assert.deepEqual(
  resolveMailEndpoints("fastmail"),
  MAIL_PROVIDER_PRESETS.fastmail,
);
assert.equal(resolveMailEndpoints("outlook").smtp.port, 587);
assert.equal(resolveMailEndpoints("outlook").smtp.secure, false);

assert.deepEqual(
  resolveMailEndpoints("gmail", {
    MAIL_SMTP_HOST: "smtp.override.test",
    MAIL_IMAP_PORT: "1993",
  }),
  {
    smtp: { host: "smtp.override.test", port: 465, secure: true },
    imap: { host: "imap.gmail.com", port: 1993, secure: true },
  },
);

assert.throws(
  () => resolveMailEndpoints("custom", {}),
  /SMTP server and incoming/,
);

const custom = resolveMailEndpoints("custom", {
  MAIL_SMTP_HOST: "mail.example.com",
  MAIL_IMAP_HOST: "mail.example.com",
  MAIL_SMTP_PORT: "587",
  MAIL_SMTP_SECURE: "false",
});
assert.deepEqual(custom, {
  smtp: { host: "mail.example.com", port: 587, secure: false },
  imap: { host: "mail.example.com", port: 993, secure: true },
});

assert.equal(buildMailCredentialsFromEnv({}), null);

const legacy = buildMailCredentialsFromEnv({
  GMAIL_USER: "me@gmail.com",
  GMAIL_APP_PASSWORD: "abcd-efgh",
});
assert.ok(legacy);
assert.equal(legacy.authMode, "password");
assert.equal(legacy.provider, "gmail");
assert.equal(legacy.user, "me@gmail.com");
assert.equal(legacy.password, "abcd-efgh");
assert.equal(legacy.smtp.host, "smtp.gmail.com");

const modern = buildMailCredentialsFromEnv({
  MAIL_PROVIDER: "fastmail",
  MAIL_USER: "me@fastmail.com",
  MAIL_PASSWORD: "secret",
});
assert.ok(modern);
assert.equal(modern.authMode, "password");
assert.equal(modern.provider, "fastmail");
assert.equal(modern.imap.host, "imap.fastmail.com");

const preferMail = buildMailCredentialsFromEnv({
  MAIL_USER: "new@example.com",
  MAIL_PASSWORD: "new-pass",
  GMAIL_USER: "old@gmail.com",
  GMAIL_APP_PASSWORD: "old-pass",
  MAIL_PROVIDER: "outlook",
});
assert.ok(preferMail);
assert.equal(preferMail.user, "new@example.com");
assert.equal(preferMail.password, "new-pass");
assert.equal(preferMail.provider, "outlook");

const incompleteCustom = buildMailCredentialsFromEnv({
  MAIL_PROVIDER: "custom",
  MAIL_USER: "a@b.com",
  MAIL_PASSWORD: "x",
});
assert.equal(incompleteCustom, null);

const oauth = buildMailCredentialsFromEnv({
  MAIL_AUTH_MODE: "oauth",
  MAIL_USER: "me@gmail.com",
  MAIL_OAUTH_REFRESH_TOKEN: "refresh-xyz",
  GOOGLE_OAUTH_CLIENT_ID: "client-id",
  GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
});
assert.ok(oauth);
assert.equal(oauth.authMode, "oauth");
assert.equal(oauth.provider, "gmail");
assert.equal(oauth.refreshToken, "refresh-xyz");
assert.equal(oauth.smtp.host, "smtp.gmail.com");
assert.equal(oauth.imap.host, "imap.gmail.com");

const oauthIncomplete = buildMailCredentialsFromEnv({
  MAIL_AUTH_MODE: "oauth",
  MAIL_USER: "me@gmail.com",
  MAIL_OAUTH_REFRESH_TOKEN: "refresh-xyz",
});
assert.equal(oauthIncomplete, null);

console.log("mail-credentials.test.ts: ok");
