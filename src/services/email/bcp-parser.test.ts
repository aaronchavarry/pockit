import { describe, expect, it } from "vitest";
import { emailToText, parseAmountMinor, parseBcpPurchase, prettifyMerchant } from "../../../supabase/functions/_shared/bcp-parser";

// Real notification layout (personal details replaced).
const SAMPLE = `Hola Cliente,

Realizaste un consumo de $ 23.60 con tu Tarjeta de Crédito BCP en ANTHROPIC* CLAUDE SUB.

Por tu seguridad, te enviamos los datos de tu operación.


Monto


Total del consumo    $ 23.60

Datos de la operación


Operación realizada    Consumo Tarjeta de Crédito
Fecha y hora    29 de octubre de 2026 - 12:30 PM
Número de Tarjeta de Crédito    ************7704
Empresa    ANTHROPIC* CLAUDE SUB
Número de operación    0000284141`;

describe("parseBcpPurchase", () => {
  it("reads the BCP card purchase email", () => {
    expect(parseBcpPurchase(SAMPLE)).toEqual({
      ok: true,
      purchase: {
        amountMinor: 2360,
        currency: "USD",
        merchant: "ANTHROPIC* CLAUDE SUB",
        description: "Anthropic Claude Sub",
        occurredOn: "2026-10-29",
        occurredTime: "12:30",
        operationNumber: "0000284141",
        cardLast4: "7704",
      },
    });
  });

  it("reads the HTML version with soles, thousands and AM times", () => {
    const html = `<table><tr><td>Realizaste un consumo de S/&nbsp;1,250.00 con tu Tarjeta de Cr&eacute;dito BCP en PLAZA VEA.</td></tr>
      <tr><td>Total del consumo</td><td>S/ 1,250.00</td></tr>
      <tr><td>Fecha y hora</td><td>3 de setiembre de 2026 - 12:05 AM</td></tr>
      <tr><td>Empresa</td><td>PLAZA VEA</td></tr><tr><td>N&uacute;mero de operaci&oacute;n</td><td>0000000042</td></tr></table>`;
    const r = parseBcpPurchase(html);
    expect(r.ok && r.purchase).toMatchObject({
      amountMinor: 125000,
      currency: "PEN",
      merchant: "PLAZA VEA",
      occurredOn: "2026-09-03",
      occurredTime: "00:05",
      operationNumber: "0000000042",
    });
  });

  it("falls back to the merchant in the opening sentence", () => {
    const r = parseBcpPurchase("Realizaste un consumo de $ 9.99 con tu Tarjeta de Crédito BCP en NETFLIX.COM. Por tu seguridad");
    expect(r.ok && r.purchase).toMatchObject({ amountMinor: 999, merchant: "NETFLIX.COM", occurredOn: null, operationNumber: null });
  });

  it("skips emails that are not purchases or lack essentials", () => {
    expect(parseBcpPurchase("Tu estado de cuenta ya está disponible")).toEqual({ ok: false, reason: "Not a card purchase notification" });
    expect(parseBcpPurchase("Realizaste un consumo de $ 0.00 con tu tarjeta en X.")).toEqual({ ok: false, reason: "Amount not found" });
    expect(parseBcpPurchase("Realizaste un consumo de $ 5.00 con tu tarjeta")).toEqual({ ok: false, reason: "Merchant not found" });
  });
});

describe("helpers", () => {
  it("parses amounts without floating point", () => {
    expect(parseAmountMinor("23.6")).toBe(2360);
    expect(parseAmountMinor("1,234.56")).toBe(123456);
    expect(parseAmountMinor("0.00")).toBeNull();
    expect(parseAmountMinor("12.345")).toBeNull();
  });
  it("cleans text and merchant names", () => {
    expect(emailToText("a&nbsp;<b>b</b>&#36;1")).toBe("a b $1");
    expect(prettifyMerchant("UBER *TRIP")).toBe("Uber Trip");
  });
});
