//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { setStrings } from "@microsoft/fabric-visuals-core";
import { strings as englishStrings } from "@microsoft/fabric-visuals-core/localization/locales/en";

// This is an English-only internal BI app, so we load only the en-US strings
// (prompt 18, ruling 1). The template's dynamic per-locale loading
// (`loadStrings` / `availableLocales`) is intentionally not used — not importing
// it lets the bundler drop the ~45 per-locale chunks fabric-visuals-core would
// otherwise code-split. English is bundled synchronously, so there is no async
// locale fetch and no Fabric settings round-trip.
export async function bootstrapLanguage(): Promise<void> {
    setStrings("en", englishStrings);
    document.documentElement.lang = "en";
}
