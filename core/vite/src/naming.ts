/**
 * Нейминг реестра: сегмент пути (kebab/snake/camel) → PascalCase.
 * `views/viewer/login-form.tsx` → `Views.Viewer.LoginForm` — папка =
 * namespace-уровень, файл = leaf (канон предка, nested не flat).
 */
export const toPascal = (segment: string): string =>
  segment
    .replace(/\.[^.]+$/, '')
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
