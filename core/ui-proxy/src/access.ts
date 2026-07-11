/**
 * Access-enforcement seam (порт капсульного access-resolver.ts).
 *
 * Резолвер ИНЖЕКТИРУЕТСЯ внешним пакетом (access/auth) на init-пути —
 * модуль не импортирует реализацию (правило портов, ADR-0001). Нет
 * резолвера → allow-all, ноль оверхеда (hasAccessResolver fast-path).
 *
 * Резолвер обязан читать реактивное состояние внутри себя — вызывается
 * ВНУТРИ реактивных скоупов (render UiProxy), мемоизация булевого
 * результата снаружи убьёт реактивность.
 *
 * NOTE ADR-0001: когда появится access-модуль кора, слот переедет туда;
 * пока единственный потребитель — ui-proxy, слот живёт здесь.
 */

export type AccessResolver = (capability: string) => boolean;

let _resolver: AccessResolver | null = null;

/** Регистрирует (или снимает, `null`) глобальный capability-резолвер. */
export const registerAccessResolver = (resolver: AccessResolver | null): void => {
  _resolver = resolver;
};

/** `true` = разрешено ИЛИ резолвер не зарегистрирован. Звать в реактивном скоупе. */
export const resolveAccess = (capability: string | undefined): boolean => {
  if (!capability) return true;
  if (!_resolver) return true;
  return _resolver(capability);
};

/** Fast-path: enforcement-точки скипают вызов целиком без резолвера. */
export const hasAccessResolver = (): boolean => _resolver !== null;
