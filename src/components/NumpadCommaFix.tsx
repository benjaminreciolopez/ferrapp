"use client";

import { useEffect } from "react";

/**
 * Componente global que intercepta la coma del teclado numérico
 * y la convierte en punto decimal en inputs numéricos.
 * En teclados españoles, la tecla del numpad produce "," pero
 * los inputs type=number solo aceptan ".".
 */
export default function NumpadCommaFix() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Detectar coma del teclado (tanto numpad como tecla normal)
      if (e.key === "," || e.key === "Decimal") {
        const target = e.target as HTMLInputElement;
        if (target && target.tagName === "INPUT" && target.type === "number") {
          e.preventDefault();

          // Insertar punto en la posición del cursor
          const start = target.selectionStart ?? target.value.length;
          const end = target.selectionEnd ?? target.value.length;
          const val = target.value;
          const newVal = val.substring(0, start) + "." + val.substring(end);

          // Usar nativeInputValueSetter para que React detecte el cambio
          const nativeSetter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value"
          )?.set;
          if (nativeSetter) {
            nativeSetter.call(target, newVal);
          } else {
            target.value = newVal;
          }

          // Posicionar cursor después del punto
          target.setSelectionRange(start + 1, start + 1);

          // Disparar evento input para que React actualice el estado
          target.dispatchEvent(new Event("input", { bubbles: true }));
          target.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    };

    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, []);

  return null;
}
