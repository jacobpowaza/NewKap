import test from 'ava';
import {requireConversionId} from '../main/common/export-start';

test('export startup rejects missing conversion ids instead of silently doing nothing', t => {
  const error = t.throws(() => requireConversionId(undefined));

  t.regex(error?.message ?? '', /Export did not start/);
});

test('export startup accepts created conversion ids', t => {
  t.is(requireConversionId('export-1'), 'export-1');
});
