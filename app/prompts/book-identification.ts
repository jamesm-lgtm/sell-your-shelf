/**
 * Book Identification Prompt v3.3
 * 
 * Validated accuracy: 89% coverage (34/38 books on test shelf)
 * Last updated: November 8, 2025
 */

export function getBookIdentificationPrompt(ocrText: string): string {
  return `You are analyzing raw OCR text from a bookshelf video. The OCR is messy with errors.

Your task: Identify ALL books - both those you're certain about AND those where you have strong evidence but need user confirmation.

OCR DATA FROM BOOKSHELF VIDEO:
${ocrText}

## Output Format

Return TWO arrays in JSON:
{
  "high_confidence": [
    {
      "title": "Book Title",
      "author": "Author Name",
      "evidence": "Brief note on what was found"
    }
  ],
  "needs_confirmation": [
    {
      "evidence_found": "What OCR text you found",
      "suggested_title": "Most likely book",
      "suggested_author": "Most likely author",
      "reasoning": "Why you think this is the book",
      "alternatives": ["Other possible books if ambiguous"]
    }
  ]
}

**No explanatory text before or after the JSON - ONLY output the JSON.**

## MULTIPLE BOOKS BY SAME AUTHOR DETECTION

**CRITICAL:** Authors can have 2-5 books on same shelf. When you see an author name 10+ times:
- Look for MULTIPLE distinct title fragments near that name
- Richard Osman → look for: MURDER, THURSDAY, BULLET, MISSED, DEVIL, LAST, CLUB
- Don't assume all mentions = one book

**Deduplication logic:**
- SAME title fragments across frames = ONE book (deduplicate)
- DIFFERENT title fragments with same author = MULTIPLE books (keep separate)

## DISTINCTIVE WORD HUNTING

When you see unique/unusual words, they're almost certainly book-related:
- SPQR → "SPQR: A History of Ancient Rome" by Mary Beard
- FERMAT → "Fermat's Last Theorem" by Simon Singh
- PIRANESI → "Piranesi" by Susanna Clarke
- FREAKONOMICS → "Freakonomics" by Levitt & Dubner

Even with OCR errors like "FERMAT'S I.AST THEOREM", you can identify confidently.

## PATTERN RECOGNITION

**Author markers:**
- Capitalized surnames: BEAUMONT, ROONEY, MELLORS
- Full names: Charles Beaumont, Sally Rooney
- Initials + surname: E.C. NEVIN, J.K. Rowling
- Multiple authors: "AND", "&" between names
- "by [name]" after title

**Title patterns:**
- "THE [NOUN]" (The Seventh Floor, The Price of Money)
- "[ADJECTIVE] [NOUN]" (Blue Sisters, Novel Murder)
- "[NAME]" (single word titles like "Dune", "Butter")
- "[VERB]ING THE [NOUN]" (Inverting the Pyramid)
- "[POSSESSIVE] [NOUN]" (Eleanor's Story, Father's Day)

## CROSS-FRAME VALIDATION

Same book appears across multiple frames:
1. Look for recurring text patterns
2. Same author appearing multiple times → high confidence
3. Fragment in Frame 5 + complement in Frame 12 = complete title

## CONFIDENCE LEVELS

**HIGH CONFIDENCE:**
- Both author + title clearly readable
- Famous distinctive title (even without author)
- Text appears multiple times with consistent details
- Unmistakable famous book even with OCR errors

**NEEDS CONFIRMATION:**
- Author name ONLY (no title visible) but author is famous
- Title ONLY but not distinctive enough
- OCR errors that need correction
- Fragmented text suggesting a book but incomplete
- Title partially visible but enough to make educated guess

## CRITICAL RULES

1. **Never invent books** - only identify based on actual OCR evidence
2. **Cross-reference across frames** - same book appears multiple times
3. **Use your knowledge** - you know famous books and authors
4. **Handle OCR errors** - "BEAUMONT" → "SEAUMONT", "YUZUKI" → "YUZUK]I"
5. **Ignore publishers** - PENGUIN, PICADOR, VINTAGE, BLOOMSBURY are not books
6. **Field guides connect** - "Birds of Britain" + "Field Guide" = one book
7. **Include alternatives** - when multiple books possible
8. **Trust recurring patterns** - text appearing 5+ times is almost certainly real
9. **Multiple books per author** - when author appears 10+ times, look for multiple distinct titles
10. **Distinctive words win** - SPQR, FERMAT, PIRANESI are unmissable

CRITICAL: Return ONLY valid JSON. No explanations, no markdown, no text before or after the JSON object.`;
}