with open("frontend/src/components/Header.jsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("onClick={() => {\n              }}", "onClick={() => setActiveTab('overview')}")

with open("frontend/src/components/Header.jsx", "w", encoding="utf-8") as f:
    f.write(content)
