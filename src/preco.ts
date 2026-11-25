import type { Ingresso, Pessoa, TipoIngresso } from "./tipos.ts";

type ValorDoIngresso = (tipo: TipoIngresso) => number;
type AplicadorDeTaxa = (valor: number) => number;

export function valorDoIngresso(precoBase: number): ValorDoIngresso {
  const meia = Math.round((precoBase / 2) * 100) / 100;
  return (tipo) => (tipo === "meia" ? meia : precoBase);
}

export function aplicarTaxa(percentual: number): AplicadorDeTaxa {
  const fator = 1 + percentual;
  return (valor) => Math.round(valor * fator * 100) / 100;
}

export function montarIngressos(
  precoBase: number,
  pessoas: readonly Pessoa[],
  temDireitoAMeia: (pessoa: Pessoa) => boolean,
): Ingresso[] {
  const calcularValor = valorDoIngresso(precoBase);

  return pessoas.map((pessoa) => {
    const tipo = temDireitoAMeia(pessoa) ? "meia" : "inteira";
    return {
      nome: pessoa.nome,
      poltrona: pessoa.poltrona,
      tipo,
      valor: calcularValor(tipo),
    };
  });
}

export function calcularTotal(ingressos: readonly Ingresso[]): number {
  const subtotal = ingressos.reduce(
    (totalAteAqui, ingresso) => totalAteAqui + ingresso.valor,
    0,
  );
  return aplicarTaxa(0.1)(subtotal);
}
