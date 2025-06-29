/**
 * Identity function for template string arrays used by jsx-lit compiler.
 *
 * This function is used as a marker by the jsx-lit compiler to identify
 * template literals that should be processed for JSX compilation. It simply
 * returns the input unchanged but signals to the compiler where JSX templates are located.
 *
 * @param strings - The template strings array from a template literal
 * @returns The same template strings array unchanged
 */
export const __$t: (strings: TemplateStringsArray) => TemplateStringsArray = s => s;
