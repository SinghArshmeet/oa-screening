import re

with open("frontend/src/components/Header.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace the onClick of the OrthoNex header
# Let's find it:
#               onClick={() => {
#                 // We can reset activeTab to 'overview'
#               }}
# Wait, I don't know exactly what's inside.

# Let's just find `title="Return to OrthoNex Main Page"`
# and the onClick above it.
content = re.sub(
    r"onClick=\{[^}]*\}\s+type=\"button\"\s+className=\"flex items-center gap-2 sm:gap-2.5 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl transition-all hover:opacity-95 active:scale-\[0.98\] cursor-pointer\"\s+title=\"Return to OrthoNex Main Page\"",
    """onClick={() => setActiveTab('overview')}
              type="button"
              className="flex items-center gap-2 sm:gap-2.5 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl transition-all hover:opacity-95 active:scale-[0.98] cursor-pointer"
              title="Return to OrthoNex Main Page\"""",
    content,
    flags=re.DOTALL
)

with open("frontend/src/components/Header.jsx", "w", encoding="utf-8") as f:
    f.write(content)
