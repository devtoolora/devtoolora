import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A time-based one-time password (TOTP, RFC 6238) is the six or eight digit code an authenticator app shows. Both sides share a secret. Every period, usually 30 seconds, each computes an HMAC of the current time step and truncates it to a short number, so the code changes without any network.',
        'This tool takes the secret as Base32 text or as an otpauth://totp/ URI, the format inside enrollment QR codes. It shows the current code with the previous and next ones, the seconds left in the step and an otpauth URI with a QR code you can scan.',
        'Validate mode checks a code you typed against the steps around a chosen time. Everything runs in your browser, so the secret is never uploaded.',
      ],
      title: 'What is a TOTP generator?',
    },
    {
      content: [
        'Test a login flow or an API that verifies one-time codes, and compare your server output with a known-good implementation.',
        'Recover a code from a secret you saved, or turn a bare secret into an otpauth URI and QR code to enroll another authenticator app.',
        'Debug clock drift: validate a code with a window of 1 or 2 steps to see whether the device is early or late. Use HMAC for raw digests and Random Token to create new secrets.',
      ],
      title: 'When to use TOTP Generator & Validator',
    },
  ],
  examples: [
    'Secret GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ, 8 digits, time 59 → 94287082 (RFC 6238 SHA-1 vector).',
    'jbsw y3dp ehpk 3pxp → read like JBSWY3DPEHPK3PXP: case, spaces and padding are ignored.',
    'otpauth://totp/Example:alice@example.com?secret=...&digits=8&period=60 → settings come from the URI.',
    'Generate with issuer Example and account alice@example.com → a URI and a QR code to scan.',
    'Validate 94287082 at time 59 → Valid · step offset 0.',
    'Validate the same code at time 89 → Valid · step offset -1, because it is one step late.',
  ],
  faq: [
    {
      answer:
        'Authenticator apps show a code for the current 30 second step. If the clock of the phone or server is off, the code belongs to a different step. Allow a window of 1 step on the server to tolerate small drift.',
      question: 'Why does my code not match the server?',
    },
    {
      answer:
        'Almost every app uses SHA-1, 6 digits and a 30 second period, which are the defaults here. Choose SHA-256, SHA-512, 8 digits or another period only if your service says so. An otpauth URI carries these settings itself.',
      question: 'Which algorithm, digits and period should I use?',
    },
    {
      answer:
        'The window is how many steps before and after the chosen time still count as valid. A window of 1 accepts the previous, current and next code. Larger windows are easier to guess, so keep it small.',
      question: 'What does the validation window mean?',
    },
    {
      answer:
        'Nothing is sent anywhere. The code is computed in your browser with Web Crypto. The secret stays out of saved drafts and summaries, but the input shows it unmasked and the result text includes the URI with the secret.',
      question: 'Is my secret uploaded or stored?',
    },
  ],
  help: 'Paste a Base32 secret or an otpauth://totp/ URI. Spaces, lowercase letters and = padding are fine.\n\nIn Generate mode set the digits, period and algorithm, and add an issuer and account for the otpauth URI.\n\nLeave Time blank to use now, or enter Unix seconds or an ISO 8601 date-time to get a repeatable code.\n\nIn Validate mode enter the code and the window, then run. Copy the code, or scan the QR code to enroll an app.',
  notes: [
    'The secret is Base32 (A-Z and 2-7) and at most 1,024 characters; a whole input is at most 4,096 characters.',
    'Digits are 6 or 8 and the period is 15 to 120 seconds; settings in an otpauth URI win over the fields.',
    'Only otpauth://totp/ URIs are supported; HOTP counter URIs are rejected.',
    'The algorithm in a URI is written SHA1, SHA256 or SHA512; the field uses SHA-1, SHA-256 and SHA-512.',
    'Time is Unix seconds or an ISO 8601 date-time; a blank field uses the current time.',
    'The window is a whole number from 0 to 10 steps each way; the lowest matching offset is reported.',
    'Validation checks every step in the window before answering, so it does not stop at the first match.',
    'The generated URI contains the secret. Treat the result text and the QR code like the secret itself.',
  ],
};
