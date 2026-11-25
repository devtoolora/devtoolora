import { hasWrongWeekday } from './emailDate';
import type { Finding } from './findings';

export type EmailHeaderField = { name: string; value: string };

type AuthResults = { dkim?: string; dmarc?: string; spf?: string };

function addressDomain(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const plain = value.replace(/\([^()]*\)/g, ' ');
  const bracketed = plain.match(/<([^<>]*)>[^<>]*$/);
  const address = (
    bracketed?.[1] ??
    plain.split(/[\s,]+/).find((part) => part.includes('@')) ??
    ''
  ).trim();
  const at = address.lastIndexOf('@');

  return at < 0 ? undefined : address.slice(at + 1).toLowerCase();
}

export type FindingInput = {
  auth: AuthResults;
  authPresent: boolean;
  date?: number;
  dateText?: string;
  fields: EmailHeaderField[];
  firstHop?: number;
  from?: string;
  hops: Array<{ by?: string; delaySeconds?: number; timestamp?: number; timestampText?: string }>;
  replyTo?: string;
  returnPath?: string;
};

function hopFindings(hops: FindingInput['hops']): Finding[] {
  const found: Finding[] = [];

  hops.forEach((hop, index) => {
    const number = index + 1;
    const delay = hop.delaySeconds;

    if (hop.timestamp === undefined) {
      found.push({ level: 'low', message: `Hop ${number} has no readable timestamp.` });
    }

    if (delay !== undefined && delay > 3600) {
      found.push({
        level: 'medium',
        message: `Hop ${number} waited ${delay.toLocaleString('en-US')} s before ${hop.by ?? 'the next server'}.`,
      });
    } else if (delay !== undefined && delay < 0) {
      found.push({
        level: 'info',
        message: `Hop ${number} has a timestamp earlier than the previous hop.`,
      });
    }
  });

  return found;
}

function authFindings(input: FindingInput): Finding[] {
  const found: Finding[] = [];

  if (!input.authPresent) {
    found.push({
      level: 'medium',
      message: 'No Authentication-Results header; SPF, DKIM and DMARC results are unknown.',
    });
  }

  for (const [name, result] of [
    ['SPF', input.auth.spf],
    ['DKIM', input.auth.dkim],
    ['DMARC', input.auth.dmarc],
  ] as const) {
    if (result === 'fail') found.push({ level: 'high', message: `${name} result is fail.` });
  }

  if (input.auth.dmarc === 'none') {
    found.push({ level: 'medium', message: 'DMARC result is none.' });
  }

  return found;
}

function domainFindings(input: FindingInput): Finding[] {
  const fromDomain = addressDomain(input.from);
  const found: Finding[] = [];

  if (fromDomain === undefined) return found;

  const replyDomain = addressDomain(input.replyTo);
  const pathDomain = addressDomain(input.returnPath);

  if (replyDomain !== undefined && replyDomain !== fromDomain) {
    found.push({
      level: 'medium',
      message: `Reply-To domain "${replyDomain}" differs from the From domain "${fromDomain}".`,
    });
  }

  if (pathDomain !== undefined && pathDomain !== fromDomain) {
    found.push({
      level: 'info',
      message: `Return-Path domain "${pathDomain}" differs from the From domain "${fromDomain}".`,
    });
  }

  return found;
}

function presenceFindings(input: FindingInput): Finding[] {
  const found: Finding[] = [];
  const names = input.fields.map((field) => field.name.toLowerCase());
  const fromCount = names.filter((name) => name === 'from').length;

  if (fromCount > 1) {
    found.push({
      level: 'high',
      message: `${fromCount === 2 ? 'Two' : fromCount} From headers are present; the sender is ambiguous.`,
    });
  }

  if (!names.includes('message-id'))
    found.push({ level: 'medium', message: 'No Message-ID header.' });

  if (input.dateText === undefined) {
    found.push({ level: 'medium', message: 'No Date header.' });
  } else if (input.date === undefined) {
    found.push({ level: 'medium', message: 'Date header is not a valid RFC 5322 date.' });
  } else if (input.firstHop !== undefined && Math.abs(input.date - input.firstHop) > 86_400_000) {
    found.push({
      level: 'medium',
      message: 'Date header is more than 86,400 s from the first hop.',
    });
  }

  if (input.dateText !== undefined && hasWrongWeekday(input.dateText))
    found.push({
      level: 'low',
      message: 'Date header names a weekday that does not match the date.',
    });

  if (names.includes('list-unsubscribe')) {
    found.push({ level: 'info', message: 'List-Unsubscribe header present (bulk or list mail).' });
  }

  const precedence = input.fields.find((field) => field.name.toLowerCase() === 'precedence');

  if (precedence?.value.trim().toLowerCase() === 'bulk') {
    found.push({ level: 'info', message: 'Precedence: bulk header present.' });
  }

  if (names.includes('x-mailer'))
    found.push({ level: 'info', message: 'X-Mailer header present.' });

  return found;
}

export function collectEmailFindings(input: FindingInput): Finding[] {
  return [
    ...presenceFindings(input),
    ...authFindings(input),
    ...domainFindings(input),
    ...hopFindings(input.hops),
  ];
}
