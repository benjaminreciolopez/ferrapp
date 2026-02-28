"use client";

import { useEffect } from "react";

/**
 * Intercepta la coma del teclado numerico en inputs numericos
 * y la convierte en punto decimal.
 * En teclados españoles la tecla del numpad produce ","
 * pero los inputs type=number solo aceptan ".".
 */
export default function NumpadCommaFix() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === "," &&
        e.target instanceof HTMLInputElement &&
        e.target.type === "number"
      ) {
        e.preventDefault();
        // execCommand inserta texto en la posicion del cursor
        // y dispara los eventos nativos que React necesita
        document.execCommand("insertText", false, ".");
      }
    };

    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, []);

  return null;
}
