import re

with open("frontend/src/components/Header.jsx", "r", encoding="utf-8") as f:
    content = f.read()

content = re.sub(
    r"onClick=\{\(\) => \{[\s\n]*\}\}\n\s*type=\"button\"\n\s*className=\"flex items-center gap-2 sm:gap-2.5 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl transition-all hover:opacity-95 active:scale-\[0.98\] cursor-pointer\"\n\s*title=\"Return to OrthoNex Main Page\"",
    """onClick={() => setActiveTab('overview')}
              type="button"
              className="flex items-center gap-2 sm:gap-2.5 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl transition-all hover:opacity-95 active:scale-[0.98] cursor-pointer"
              title="Return to OrthoNex Main Page\"""",
    content
)

with open("frontend/src/components/Header.jsx", "w", encoding="utf-8") as f:
    f.write(content)
