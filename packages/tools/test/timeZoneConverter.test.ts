import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { timeZoneConverterTool } from '../src/catalog/dateTime';
import { contentOf } from './toolContent';

describe('time zone converter tool', () => {
  it('declares its metadata and content', () => {
    assert.equal(timeZoneConverterTool.category, 'Date & Time');
    assert.equal(timeZoneConverterTool.autoRun, true);

    assert.equal(
      timeZoneConverterTool.fields?.map((field) => field.id).join(','),
      'fromZone,zones',
    );

    assert.match(contentOf(timeZoneConverterTool).notes?.join(' ') ?? '', /50/);
  });

  it('converts into a table', async () => {
    const result = await timeZoneConverterTool.run({
      fields: { fromZone: 'UTC', zones: 'Asia/Tokyo' },
      text: '2026-07-01T12:00',
    });

    assert.deepEqual(result.jsonTable?.rows[0], [
      'Asia/Tokyo',
      '2026-07-01 21:00:00',
      '+09:00',
      'same day',
    ]);

    assert.equal(JSON.parse(result.text).instant, '2026-07-01T12:00:00.000Z');
  });

  it('labels day shifts beyond one day', async () => {
    const shifted = await timeZoneConverterTool.run({
      fields: { fromZone: 'Pacific/Pago_Pago', zones: 'Pacific/Kiritimati, UTC' },
      text: '2026-07-01T23:00',
    });
    const back = await timeZoneConverterTool.run({
      fields: { fromZone: 'Pacific/Kiritimati', zones: 'Pacific/Pago_Pago' },
      text: '2026-07-03T00:30',
    });

    assert.deepEqual(
      shifted.jsonTable?.rows.map((row) => row[3]),
      ['+2 days', 'next day'],
    );

    assert.equal(back.jsonTable?.rows[0]?.[3], '-2 days');
  });

  it('reports readable errors', async () => {
    await assert.rejects(
      async () =>
        timeZoneConverterTool.run({ fields: { fromZone: 'UTC', zones: 'Nowhere/City' }, text: '' }),
      /Unknown time zone "Nowhere\/City"/,
    );

    await assert.rejects(
      async () =>
        timeZoneConverterTool.run({
          fields: { fromZone: 'UTC', zones: Array(51).fill('UTC').join(',') },
          text: '',
        }),
      /50/,
    );
  });
});
