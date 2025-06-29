/**
 * @fileoverview Internal lit-html part constructors for jsx-lit compiler.
 *
 * This module exports the internal part constructors from lit-html that are used
 * by the lit-jsx compiler to create optimized template parts. These are low-level
 * utilities used internally by the compilation process.
 */

import * as internals from 'lit-html/private-ssr-support.js';


/** Boolean attribute part constructor from lit-html internals */
export const BooleanPart:   typeof internals._$LH.BooleanAttributePart = internals._$LH.BooleanAttributePart;

/** Attribute part constructor from lit-html internals */
export const AttributePart: typeof internals._$LH.AttributePart = internals._$LH.AttributePart;

/** Property part constructor from lit-html internals */
export const PropertyPart:  typeof internals._$LH.PropertyPart  = internals._$LH.PropertyPart;

/** Element part constructor from lit-html internals */
export const ElementPart:   typeof internals._$LH.ElementPart   = internals._$LH.ElementPart;

/** Event part constructor from lit-html internals */
export const EventPart:     typeof internals._$LH.EventPart     = internals._$LH.EventPart;

/** Child part constructor from lit-html internals */
export const ChildPart:     typeof internals._$LH.ChildPart     = internals._$LH.ChildPart;
