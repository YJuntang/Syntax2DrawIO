import { expect, test } from 'vitest';
import { addPlantUMLTransparentBackground, preprocessPlantUML } from './preprocessor';

test('normalizes wrappers and multiline notes', () => {
  expect(preprocessPlantUML([
    '@STARTUML sample',
    'Alice -> Bob: hello',
    'note right of Bob',
    '  first line',
    '  second line',
    'end note',
    '@ENDUML',
  ].join('\r\n'))).toEqual([
    { text: 'Alice -> Bob: hello', line: 2 },
    { text: 'note right of Bob: first line\nsecond line', line: 3 },
  ]);
});

test('inserts the transparent background directive before the end marker', () => {
  const result = addPlantUMLTransparentBackground('@startuml\nAlice -> Bob\n@enduml');

  expect(result).toBe('@startuml\nAlice -> Bob\nskinparam backgroundcolor transparent\n@enduml');
});
