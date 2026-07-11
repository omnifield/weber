import { describe, expect, it } from 'vitest';
import { DEFAULT_CONVENTIONS } from '../conventions';
import { deriveInputType, deriveName, getTargetData } from '../derivation';

const MAP = DEFAULT_CONVENTIONS.tagToInputType;

describe('deriveName', () => {
  it('первый конкретный тег (без @-префикса)', () => {
    expect(deriveName({ tags: ['@inputs', 'email', 'primary'] })).toBe('email');
  });
  it('undefined без meta/тегов', () => {
    expect(deriveName(undefined)).toBeUndefined();
    expect(deriveName({ tags: ['@only-alias'] })).toBeUndefined();
  });
});

describe('deriveInputType (closed-set карта из конвенций)', () => {
  it('маппит типовые теги', () => {
    expect(deriveInputType({ tags: ['password'] }, MAP)).toBe('password');
    expect(deriveInputType({ tags: ['phone'] }, MAP)).toBe('tel');
  });
  it('undefined вне карты', () => {
    expect(deriveInputType({ tags: ['submit'] }, MAP)).toBeUndefined();
  });
  it('кастомная карта конвенций работает', () => {
    expect(deriveInputType({ tags: ['secret'] }, { secret: 'password' })).toBe('password');
  });
});

describe('getTargetData — приоритет value', () => {
  it('checkbox → checked', () => {
    const e = { currentTarget: { type: 'checkbox', checked: true, value: 'on' } } as any;
    expect(getTargetData(e, {}).value).toBe(true);
  });
  it('el.value над rawValue и props.value', () => {
    const e = { currentTarget: { value: 'dom' } } as any;
    expect(getTargetData(e, { value: 'props' }, undefined, 'raw').value).toBe('dom');
  });
  it('rawValue (kobalte) над props.value, без event', () => {
    const t = getTargetData(undefined, { value: 'props' }, undefined, 'raw');
    expect(t.value).toBe('raw');
    expect(t.modifiers).toBeUndefined();
  });
  it('name: el.name → derivedName → props.name', () => {
    expect(getTargetData(undefined, { name: 'p' }, 'derived').name).toBe('derived');
    expect(getTargetData(undefined, { name: 'p' }).name).toBe('p');
  });
});
