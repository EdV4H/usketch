#!/bin/bash

# Function to convert PascalCase/camelCase to kebab-case
to_kebab_case() {
  echo "$1" | sed 's/\([A-Z]\)/-\1/g' | sed 's/^-//' | tr '[:upper:]' '[:lower:]'
}

# Main files to rename (excluding test files, config files, and special cases)
declare -A RENAMES=(
  ["apps/whiteboard-react/src/App.tsx"]="apps/whiteboard-react/src/app.tsx"
  ["apps/whiteboard-react/src/components/Toolbar.tsx"]="apps/whiteboard-react/src/components/toolbar.tsx"
  ["apps/whiteboard-react/src/components/Whiteboard.tsx"]="apps/whiteboard-react/src/components/whiteboard.tsx"
  ["apps/whiteboard-react/src/hooks/useStore.ts"]="apps/whiteboard-react/src/hooks/use-store.ts"
  ["packages/drawing-tools/src/RectangleTool.ts"]="packages/drawing-tools/src/rectangle-tool.ts"
  ["packages/drawing-tools/src/SelectTool.ts"]="packages/drawing-tools/src/select-tool.ts"
  ["packages/drawing-tools/src/Tool.ts"]="packages/drawing-tools/src/tool.ts"
  ["packages/drawing-tools/src/ToolManager.ts"]="packages/drawing-tools/src/tool-manager.ts"
  ["packages/ui-components/src/SelectionLayer.ts"]="packages/ui-components/src/selection-layer.ts"
)

# Rename files
for OLD_PATH in "${!RENAMES[@]}"; do
  NEW_PATH="${RENAMES[$OLD_PATH]}"
  if [ -f "$OLD_PATH" ]; then
    echo "Renaming $OLD_PATH to $NEW_PATH"
    mv "$OLD_PATH" "$NEW_PATH"
  fi
done

# Update imports in all TypeScript files
echo "Updating imports..."

# Update specific imports
find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | while read file; do
  # Component imports
  sed -i '' 's|from "./App"|from "./app"|g' "$file"
  sed -i '' 's|from "./components/Toolbar"|from "./components/toolbar"|g' "$file"
  sed -i '' 's|from "./components/Whiteboard"|from "./components/whiteboard"|g' "$file"
  sed -i '' 's|from "../hooks/useStore"|from "../hooks/use-store"|g' "$file"
  
  # Drawing tools imports
  sed -i '' 's|from "./Tool"|from "./tool"|g' "$file"
  sed -i '' 's|from "./RectangleTool"|from "./rectangle-tool"|g' "$file"
  sed -i '' 's|from "./SelectTool"|from "./select-tool"|g' "$file"
  sed -i '' 's|from "./ToolManager"|from "./tool-manager"|g' "$file"
  
  # UI components imports
  sed -i '' 's|from "./SelectionLayer"|from "./selection-layer"|g' "$file"
  
  # Export updates in index files
  sed -i '' 's|from "./tool-manager"|from "./tool-manager"|g' "$file"
  sed -i '' 's|from "./selection-layer"|from "./selection-layer"|g' "$file"
done

echo "File renaming complete!"