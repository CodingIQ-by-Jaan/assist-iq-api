import { esPinDebil, FORMATO_PIN, generarPin } from './pin.util';

describe('esPinDebil', () => {
  it.each(['0000', '1111', '999999', '1234', '4321', '2345', '123456', '654321'])(
    'rechaza %s',
    (pin) => expect(esPinDebil(pin)).toBe(true),
  );

  it.each(['4827', '1357', '2468', '1122', '907315'])('acepta %s', (pin) =>
    expect(esPinDebil(pin)).toBe(false),
  );
});

describe('generarPin', () => {
  it('genera PIN de 4 dígitos que nunca son débiles', () => {
    for (let i = 0; i < 500; i++) {
      const pin = generarPin();
      expect(pin).toMatch(FORMATO_PIN);
      expect(pin).toHaveLength(4);
      expect(esPinDebil(pin)).toBe(false);
    }
  });
});
