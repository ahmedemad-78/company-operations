import { clsx } from "clsx";

export function Brand({ size = "sidebar" }: { size?: "login" | "sidebar" | "compact" }) {
  return (
    <span className="block" aria-label="الأمير موتورز">
      <span
        aria-hidden="true"
        className={clsx("brand-wordmark block whitespace-nowrap", {
          "text-[3.5rem] sm:text-[4.25rem]": size === "login",
          "text-[2rem]": size === "sidebar",
          "text-2xl": size === "compact",
        })}
      >
        الْأَمِير مُوتُورْز
      </span>
      {size !== "compact" && (
        <span aria-hidden="true" dir="ltr" className="mt-1 block font-sans text-[10px] tracking-[0.28em] opacity-70">
          AL AMIR MOTORS
        </span>
      )}
    </span>
  );
}
