/**
 * GUI files (docs/PLAN.md, step 10; docs/gui-syntax.md): the GUI syntax tree, its parser, and
 * what a GUI file defines and uses for the workspace index (`extract.ts`).
 */

export {
    GUI_NAMED_KEYWORDS,
    GUI_TYPE_KEYWORDS,
    guiBlockOf,
    guiNameOf,
    isNamedKeyword,
    isTypeKeyword,
    type GuiBlock,
    type GuiFile,
    type GuiItem,
    type GuiNamed,
    type GuiProperty,
    type GuiType,
} from './tree.js';
export { parseGui, readGui, type GuiParseResult, type GuiSourceFile } from './parser.js';
