import re

with open('src/routes/index.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Add wallet_transactions to tableModelMapping
search_mapping = r'    payments: "Payment",'
replace_mapping = r'    payments: "Payment",\n    wallet_transactions: "WalletTransaction",'
content = re.sub(search_mapping, replace_mapping, content)

# Add search columns for WalletTransaction
search_searchCols = r'    Investment: \["investor", "startup"\],'
replace_searchCols = r'    Investment: ["investor", "startup"],\n    WalletTransaction: ["type", "description", "status"],'
content = re.sub(search_searchCols, replace_searchCols, content)

# Add include for WalletTransaction
search_include = r'            : modelName === "City"'
replace_include = r'            : modelName === "WalletTransaction"\n              ? { wallet: { include: { user: { select: { id: true, fullName: true, email: true, role: true } } } } }\n              : modelName === "City"'
content = re.sub(search_include, replace_include, content)

with open('src/routes/index.ts', 'w', encoding='utf-8') as f:
    f.write(content)
