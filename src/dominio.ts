import type { EventoInfo } from "./tipos.ts";

export abstract class ErroDeNegocio extends Error {
  readonly status: number;

  constructor(mensagem: string, status: number) {
    super(mensagem);
    this.status = status;
    this.name = new.target.name;
  }
}

export class DadosInvalidosErro extends ErroDeNegocio {
  constructor(mensagem: string) {
    super(mensagem, 400);
  }
}

export class NaoEncontradoErro extends ErroDeNegocio {
  constructor(mensagem: string) {
    super(mensagem, 404);
  }
}

export class PoltronaOcupadaErro extends ErroDeNegocio {
  constructor(mensagem: string) {
    super(mensagem, 409);
  }
}

export class PagamentoErro extends ErroDeNegocio {
  constructor(mensagem: string) {
    super(mensagem, 502);
  }
}

export class Evento {
  #id: number;
  #nome: string;
  #preco: number;
  #capacidade: number;
  #vendidas: number[];

  constructor(id: number, nome: string, preco: number, capacidade: number) {
    this.#id = id;
    this.#nome = nome;
    this.#preco = preco;
    this.#capacidade = capacidade;
    this.#vendidas = [];
  }

  get id(): number {
    return this.#id;
  }

  get nome(): string {
    return this.#nome;
  }

  get preco(): number {
    return this.#preco;
  }

  get capacidade(): number {
    return this.#capacidade;
  }

  get disponivel(): number {
    return this.#capacidade - this.#vendidas.length;
  }

  reservar(poltronas: readonly number[]): void {
    if (poltronas.length === 0) {
      throw new DadosInvalidosErro("A lista de poltronas não pode estar vazia.");
    }

    const vistas = new Set<number>();
    for (const poltrona of poltronas) {
      if (!Number.isInteger(poltrona) || poltrona < 1 || poltrona > this.#capacidade) {
        throw new DadosInvalidosErro(`Poltrona inválida: ${poltrona}.`);
      }
      if (vistas.has(poltrona)) {
        throw new DadosInvalidosErro(`Poltrona repetida no pedido: ${poltrona}.`);
      }
      vistas.add(poltrona);
    }

    for (const poltrona of poltronas) {
      if (this.#vendidas.includes(poltrona)) {
        throw new PoltronaOcupadaErro(`Poltrona já ocupada: ${poltrona}.`);
      }
    }

    for (const poltrona of poltronas) {
      this.#vendidas.push(poltrona);
    }
  }

  liberar(poltronas: readonly number[]): void {
    const vistas = new Set<number>();
    for (const poltrona of poltronas) {
      if (vistas.has(poltrona) || !this.#vendidas.includes(poltrona)) {
        throw new DadosInvalidosErro(`Poltrona não está vendida: ${poltrona}.`);
      }
      vistas.add(poltrona);
    }

    this.#vendidas = this.#vendidas.filter((poltrona) => !vistas.has(poltrona));
  }

  info(): EventoInfo {
    return {
      id: this.#id,
      nome: this.#nome,
      preco: this.#preco,
      capacidade: this.#capacidade,
      disponivel: this.disponivel,
    };
  }
}
