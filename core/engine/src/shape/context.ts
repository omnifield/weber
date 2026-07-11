import { createContext, useContext } from 'solid-js';

/**
 * Проброс проксированного Ui из View/Widget/Page в Shape: обёртки провайдят
 * `<ShapeUiContext.Provider value={Ui}>`, Shape резолвит `bind.as`-tracker'ы
 * по этому namespace на рендере.
 */
export type IShapeUiNamespace = Record<string, unknown>;

export const ShapeUiContext = createContext<IShapeUiNamespace | null>(null);

export const useShapeUi = () => useContext(ShapeUiContext);
