# Task 5: Drag-and-Drop Between Nesting Levels - Implementation Notes

## Status: Foundation Created, Integration Pending

### What Has Been Completed

1. **DragContext Created** (`src/contexts/DragContext.tsx`)
   - Created a global DragContext with DragProvider
   - Extended DragState to include:
     - `sourceParentBindingId`: Tracks where the drag originated (null for top level)
     - `dropTargetBindingId`: Tracks which binding is being hovered over
     - `dropTargetIndex`: Tracks the index within the target binding
   - Provides methods: `startDrag`, `setDropTarget`, `endDrag`, `cancelDrag`

### What Remains To Be Done

#### 1. Wrap App with DragProvider
```typescript
// In App.tsx or main.tsx
import { DragProvider } from '@/contexts/DragContext'

function App() {
  return (
    <DragProvider>
      {/* existing app content */}
    </DragProvider>
  )
}
```

#### 2. Update BindingCard to Use Global Context

The BindingCard currently uses a local `useCustomDrag` hook. It needs to:

1. Import and use `useDragContext` instead
2. Show drop zones when ANY drag is happening (not just local drags)
3. Update `handleDetailDragStartInBinding` and `handleBindingDragStartInBinding` to:
   - Use the global context's `startDrag`
   - Pass the current binding's `bitrixId` as `parentBindingId`
4. Implement drop zone logic that:
   - Shows drop zones for ALL bindings when dragging
   - Calls `setDropTarget(binding.bitrixId, index)` on hover
   - Handles mouseup to perform the drop

#### 3. Implement Cross-Level Drop Logic

When a drop occurs in BindingCard:

```typescript
const handleDrop = () => {
  const { dragState, endDrag } = useDragContext()
  
  if (!dragState.dropTargetBindingId || !dragState.draggedItemId) {
    endDrag(false)
    return
  }
  
  // Find the dragged item
  const draggedItem = findItemById(dragState.draggedItemId)
  const draggedBitrixId = draggedItem.bitrixId
  
  // Check if same parent or different parent
  if (dragState.sourceParentBindingId === dragState.dropTargetBindingId) {
    // Same parent - use CHANGE_DETAIL_SORT_REQUEST
    postMessageBridge.sendChangeDetailSortRequest({
      parentId: dragState.sourceParentBindingId,
      sorting: calculateNewSorting()
    })
  } else {
    // Different parent - use CHANGE_DETAIL_LEVEL_REQUEST
    postMessageBridge.sendChangeDetailLevelRequest({
      fromParentId: dragState.sourceParentBindingId!,
      detailId: draggedBitrixId,
      toParentId: dragState.dropTargetBindingId,
      sorting: calculateNewSorting()
    })
  }
  
  endDrag(true)
}
```

#### 4. Prevent Top-Level Drops

The requirement states that elements cannot be dragged to the top level (outside all bindings).

Options:
1. Only show drop zones inside bindings (no top-level drop zones)
2. Show a visual indicator that top-level drops are not allowed
3. Ignore drops that occur outside bindings

#### 5. Update App.tsx Top-Level Drag Handlers

Currently, App.tsx handles drag-and-drop for top-level elements using the local `useCustomDrag`. This needs to be updated to use the global context as well, or we need to decide if top-level drag-and-drop should be disabled (since items can't be moved to top level per requirements).

### Technical Considerations

1. **Performance**: Showing drop zones in ALL bindings during drag could impact performance if there are many bindings. Consider:
   - Lazy rendering of drop zones
   - Limiting the number of visible drop zones
   - Using virtual scrolling for large binding lists

2. **Visual Feedback**: Need clear visual indicators for:
   - Valid drop targets
   - Invalid drop targets (e.g., dragging to same position)
   - Cross-level vs same-level drops

3. **Nested Bindings**: The logic needs to handle deeply nested bindings correctly:
   - A binding inside another binding should also show drop zones
   - Need to prevent circular nesting (binding A inside binding B inside binding A)

4. **Conflict with Existing Drag Logic**: BindingCard currently has its own local drag-and-drop implementation. This needs to be carefully migrated to use the global context without breaking existing functionality.

### Recommended Approach

1. Start with a feature flag to enable/disable cross-level dragging
2. Implement and test in stages:
   - Stage 1: Wrap app with DragProvider, keep existing logic working
   - Stage 2: Update one BindingCard to use global context
   - Stage 3: Add cross-level drop detection
   - Stage 4: Implement CHANGE_DETAIL_LEVEL_REQUEST
   - Stage 5: Test thoroughly with various nesting scenarios
3. Add comprehensive error handling and validation
4. Consider adding undo/redo functionality for complex drag operations

### Testing Checklist

- [ ] Drag within same binding (existing functionality)
- [ ] Drag from one binding to another at same level
- [ ] Drag from nested binding to parent binding
- [ ] Drag from parent binding to nested binding
- [ ] Attempt to drag to top level (should be prevented)
- [ ] Drag with deeply nested bindings (3+ levels)
- [ ] Cancel drag (Esc key or click outside)
- [ ] Performance with many bindings (10+)
- [ ] Visual feedback is clear and correct
- [ ] Bitrix receives correct CHANGE_DETAIL_LEVEL_REQUEST payload

### Notes

This is a complex feature that touches many parts of the codebase. It should be implemented carefully with thorough testing to avoid regressions in existing drag-and-drop functionality.

The foundation (DragContext) is in place, but integration requires careful coordination between App.tsx, BindingCard.tsx, and the drag event handlers.
