import { ToolDefinition } from '@devtoolora/core';
import * as webFunctions from '@devtoolora/functions/web';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, identityOutput } from '../shared';

const newsletter = [
  'Return-Path: <bounce@mail.example.net>',
  'Received: from mail.example.net (mail.example.net [203.0.113.5])',
  ' by mx.example.com with ESMTPS id abc123',
  ' for <bob@example.com>; Wed, 21 Oct 2026 07:28:10 +0000',
  'Received: from [10.0.0.2] (unknown [10.0.0.2])',
  '\tby mail.example.net with ESMTPSA id xyz; Wed, 21 Oct 2026 07:28:00 +0000',
  'Authentication-Results: mx.example.com; spf=pass smtp.mailfrom=mail.example.net; dkim=pass header.d=example.net; dmarc=pass header.from=example.net',
  'DKIM-Signature: v=1; a=rsa-sha256; d=example.net; s=sel1; h=from:to:subject; bh=abc; b=def',
  'From: Alice <alice@example.net>',
  'Reply-To: other@elsewhere.example',
  'To: Bob <bob@example.com>',
  'Subject: Hello',
  'Date: Wed, 21 Oct 2026 07:27:58 +0000',
  'Message-ID: <id1@example.net>',
].join('\n');

const common = 'Date: Wed, 21 Oct 2026 07:28:00 +0000\nMessage-ID: <1@example.net>';

export const emailHeaderAnalyzerTool: ToolDefinition = {
  id: 'email-header-analyzer',
  name: 'Email Header Analyzer',
  category: 'Web/API',
  description:
    'Trace the Received hops, delays, SPF, DKIM and DMARC results and suspicious sender headers of a pasted email header block.',
  samples: [
    { label: 'Delivered newsletter', text: newsletter },
    {
      label: 'Reply-To mismatch',
      text: `From: Support <support@bank.example>\nReply-To: help@scam.example\nAuthentication-Results: mx.example.com; spf=pass; dkim=pass; dmarc=pass\n${common}`,
    },
    {
      label: 'Failed DMARC',
      text: `From: Boss <boss@corp.example>\nAuthentication-Results: mx.example.com; spf=fail; dkim=none; dmarc=fail header.from=corp.example\n${common}`,
    },
    {
      label: 'Slow relay',
      text: `Received: from relay.example by mx.example.com; Wed, 21 Oct 2026 09:28:00 +0000\nReceived: from client.example by relay.example; Wed, 21 Oct 2026 07:28:00 +0000\nFrom: a@client.example\nAuthentication-Results: mx.example.com; spf=pass\n${common}`,
    },
    {
      label: 'Missing Date and Message-ID',
      text: 'From: a@example.net\nSubject: Test\nAuthentication-Results: mx.example.com; spf=pass',
    },
    {
      label: 'mbox copy with a body',
      text: `From alice@example.net Wed Oct 21 07:28:00 2026\nFrom: Alice <alice@example.net>\nTo: bob@example.com\nSubject: Hi\n${common}\n\nThe body is ignored.`,
    },
  ],
  inputKind: 'text',
  outputKind: 'json',
  supportsSelection: true,
  sensitiveInput: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  keywords: [
    'email headers',
    'received',
    'spf',
    'dkim',
    'dmarc',
    'authentication-results',
    'mail trace',
    'phishing',
  ],
  relatedToolIds: ['email-normalizer', 'http-headers-parser', 'secret-redactor'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ text }) => {
    const report = withToolError(() => webFunctions.analyzeEmailHeaders(text));
    const hops = report.received.length;
    const { dkim, dmarc, spf } = report.authentication;
    const parts = [`${hops} ${hops === 1 ? 'hop' : 'hops'}`];

    if (report.totalTransitSeconds !== undefined) {
      parts.push(`${report.totalTransitSeconds.toLocaleString('en-US')} s transit`);
    }

    parts.push(
      `SPF ${spf ?? 'unknown'}`,
      `DKIM ${dkim ?? 'unknown'}`,
      `DMARC ${dmarc ?? 'unknown'}`,
      webFunctions.summarizeFindings(report.findings),
    );

    return identityOutput(
      JSON.stringify(report, null, 2),
      'email-headers.json',
      parts.join(' · '),
      true,
    );
  },
};
