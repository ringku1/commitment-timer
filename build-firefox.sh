#!/bin/bash
echo "🦊 Building Firefox version..."

# Clean and recreate
rm -rf firefox-build
mkdir -p firefox-build/{background,content,popup,options,dashboard,assets,docs/images}

# Copy all source files
cp -r background/* firefox-build/background/
cp -r content/* firefox-build/content/
cp -r assets/* firefox-build/assets/
cp browser-polyfill.js firefox-build/

# Copy HTML/JS files
cp popup/popup.html firefox-build/popup/
cp popup/popup.js firefox-build/popup/
cp options/options.html firefox-build/options/
cp options/options.js firefox-build/options/
cp dashboard/dashboard.html firefox-build/dashboard/
cp dashboard/dashboard.js firefox-build/dashboard/

# Copy docs
cp docs/privacy-policy.html firefox-build/docs/
cp docs/images/* firefox-build/docs/images/

# Use Firefox manifest
cp manifest.firefox.json firefox-build/manifest.json

# Add polyfill script tag to all HTML files
for f in firefox-build/popup/popup.html firefox-build/options/options.html firefox-build/dashboard/dashboard.html; do
  sed -i 's|<head>|<head>\n  <script src="../browser-polyfill.js"></script>|' "$f"
done

# Fix popup polyfill path (popup is one level deep)
sed -i 's|src="../browser-polyfill.js"|src="../browser-polyfill.js"|' firefox-build/popup/popup.html

echo "✅ Firefox build ready in firefox-build/"
echo ""
echo "📦 To load in Firefox:"
echo "   1. Go to about:debugging"
echo "   2. Click 'This Firefox'"
echo "   3. Click 'Load Temporary Add-on'"
echo "   4. Select firefox-build/manifest.json"