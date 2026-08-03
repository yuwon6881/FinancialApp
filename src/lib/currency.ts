/**
 * Last-resort currency, used only where a form needs a starting value before the
 * portfolio (and with it the user's real currency) has loaded.
 *
 * It exists because a select has to open on *something*; every path that knows
 * the user's currency must prefer that. Defined once so the literal cannot drift
 * apart across forms — and so there is a single place to change if this app ever
 * ships somewhere the assumption is wrong.
 */
export const FALLBACK_CURRENCY = 'USD'
