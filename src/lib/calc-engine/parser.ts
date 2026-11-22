// 公式解析器（批 2）：spec §3.1 文法。
import { ENGINE_FUNCTIONS } from "./functions";

export interface FormulaSyntaxError extends Error {
  position: number;
}

export function isFormulaSyntaxError(e: unknown): e is FormulaSyntaxError & Error {
  return e instanceof Error && typeof (e as { position?: unknown }).position === "number";
}

export type AstNode =
  | { kind: "num"; value: number }
  | { kind: "ident"; name: string; position: number }
  | { kind: "call"; name: string; args: AstNode[] }
  | { kind: "unary"; op: "-"; operand: AstNode }
  | { kind: "binary"; op: "+" | "-" | "*" | "/" | "^"; left: AstNode; right: AstNode };

interface Token {
  type: "num" | "ident" | "op" | "lparen" | "rparen" | "comma";
  value: string;
  position: number;
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === " " || c === "\t") {
      i += 1;
    } else if (c >= "0" && c <= "9") {
      let j = i;
      while (j < src.length && ((src[j]! >= "0" && src[j]! <= "9") || src[j] === "."))
        j += 1;
      tokens.push({ type: "num", value: src.slice(i, j), position: i });
      i = j;
    } else if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j]!)) j += 1;
      // 挂账 58（人裁 ① ident 键=IP 码）：ident 内嵌「-<数字>」并入同一 ident
      // （IP-0621 是参数码不是减法）。只吸无空格紧邻且连字符后紧跟数字的形状——
      // 带空格减法 `A - B` 与负号不受扰；现行种子 formula 零裸减号形状（已盘）。
      while (src[j] === "-" && /[0-9]/.test(src[j + 1] ?? "")) {
        j += 1;
        while (j < src.length && /[0-9]/.test(src[j]!)) j += 1;
      }
      tokens.push({ type: "ident", value: src.slice(i, j), position: i });
      i = j;
    } else if (c === "(") {
      tokens.push({ type: "lparen", value: c, position: i });
      i += 1;
    } else if (c === ")") {
      tokens.push({ type: "rparen", value: c, position: i });
      i += 1;
    } else if (c === ",") {
      tokens.push({ type: "comma", value: c, position: i });
      i += 1;
    } else if ("+-*/^".includes(c)) {
      tokens.push({ type: "op", value: c, position: i });
      i += 1;
    } else {
      throw syntaxErr("unrecognized char", i);
    }
  }
  return tokens;
}

function syntaxErr(message: string, position: number): FormulaSyntaxError & Error {
  const err = new Error(message) as FormulaSyntaxError & Error;
  err.position = position;
  return err;
}

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(src: string) {
    this.tokens = tokenize(src);
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private next(): Token {
    const t = this.tokens[this.pos];
    if (!t) throw syntaxErr("unexpected end of formula", srcLenOf(this.tokens));
    this.pos += 1;
    return t;
  }

  private srcLen(): number {
    return srcLenOf(this.tokens);
  }

  parse(): AstNode {
    const node = this.expr();
    const rest = this.peek();
    if (rest) throw syntaxErr("unexpected trailing token", rest.position);
    return node;
  }

  private expr(): AstNode {
    let left = this.term();
    while (
      this.peek()?.type === "op" &&
      (this.peek()!.value === "+" || this.peek()!.value === "-")
    ) {
      const opTok = this.next();
      left = { kind: "binary", op: opTok.value as "+" | "-", left, right: this.term() };
    }
    return left;
  }

  private term(): AstNode {
    let left = this.power();
    while (
      this.peek()?.type === "op" &&
      (this.peek()!.value === "*" || this.peek()!.value === "/")
    ) {
      const opTok = this.next();
      left = { kind: "binary", op: opTok.value as "*" | "/", left, right: this.power() };
    }
    return left;
  }

  private power(): AstNode {
    if (this.peek()?.type === "op" && this.peek()!.value === "-") {
      this.next();
      return { kind: "unary", op: "-", operand: this.power() };
    }
    const base = this.primary();
    if (this.peek()?.type === "op" && this.peek()!.value === "^") {
      this.next();
      return { kind: "binary", op: "^", left: base, right: this.power() };
    }
    return base;
  }

  private primary(): AstNode {
    const t = this.next();
    if (t.type === "num") {
      const v = Number(t.value);
      if (!Number.isFinite(v)) throw syntaxErr("bad number", t.position);
      return { kind: "num", value: v };
    }
    if (t.type === "ident") {
      if (this.peek()?.type === "lparen") {
        this.next();
        const args: AstNode[] = [];
        if (this.peek()?.type === "rparen") {
          this.next();
        } else {
          args.push(this.expr());
          while (this.peek()?.type === "comma") {
            this.next();
            args.push(this.expr());
          }
          if (this.peek()?.type !== "rparen")
            throw syntaxErr("expected )", this.srcLen());
          this.next();
        }
        validateCall(t.value, args.length, t.position);
        if (t.value === "ROUND_HALF_EVEN") checkRoundDigitsLiteral(args[1]!, t.position);
        return { kind: "call", name: t.value, args };
      }
      return { kind: "ident", name: t.value, position: t.position };
    }
    if (t.type === "lparen") {
      const node = this.expr();
      if (this.peek()?.type === "rparen") this.next();
      else throw syntaxErr("expected )", this.srcLen());
      return node;
    }
    throw syntaxErr("unexpected token", t.position);
  }
}

function srcLenOf(tokens: Token[]): number {
  const last = tokens[tokens.length - 1];
  return last ? last.position + 1 : 0;
}

export function parseFormula(formula: string): AstNode {
  return new Parser(formula).parse();
}

/** formula 串引用的全部 ident（按出现序，去重）——formula 合成卡跨参数取数键集
 * （挂账 58：ident 键=IP 码，DataEntryPage 以此从同报告他参数记录取实测值）。 */
export function formulaIdents(formula: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const walk = (node: AstNode): void => {
    switch (node.kind) {
      case "ident":
        if (!seen.has(node.name)) {
          seen.add(node.name);
          out.push(node.name);
        }
        break;
      case "call":
        node.args.forEach(walk);
        break;
      case "unary":
        walk(node.operand);
        break;
      case "binary":
        walk(node.left);
        walk(node.right);
        break;
      default:
        break;
    }
  };
  walk(parseFormula(formula));
  return out;
}

export function validateCall(name: string, argCount: number, position: number): void {
  if (!(name in ENGINE_FUNCTIONS)) throw syntaxErr(`unknown function ${name}`, position);
  if (name === "PI" && argCount !== 0) throw syntaxErr("PI() takes 0 args", position);
  if (name === "ROUND_HALF_EVEN" && argCount !== 2)
    throw syntaxErr("ROUND_HALF_EVEN takes 2 args", position);
}

function checkRoundDigitsLiteral(arg: AstNode, position: number): void {
  if (arg.kind !== "num") return;
  if (!Number.isInteger(arg.value))
    throw syntaxErr("ROUND_HALF_EVEN digits must be an integer", position);
}
