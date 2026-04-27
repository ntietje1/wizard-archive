Fix the following issues. The issues can be from different files or can overlap on same lines in one file.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/components/__tests__/canvas-connection-layer.test.tsx around lines 140 - 177, The test creates an engine via createCanvasEngine() inside the test and calls engine.destroy() at the end, which can be skipped on assertion failure; instead instantiate the engine in a shared scope (e.g. let engine) and either create it in beforeEach or at top of the describe, then add an afterEach that calls engine.destroy() (guarding for undefined) so every test cleans up reliably; update references inside the test to use the shared engine and remove the inline engine.destroy() call.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/components/__tests__/canvas-connection-layer.test.tsx around lines 73 - 84, The switch in buildExpectedPath does not handle unknown CanvasEdgeType values and can silently return undefined; update buildExpectedPath to add an exhaustive check (e.g., a default case that throws or an assert using a never-typed unreachable function) so any new CanvasEdgeType causes a test failure; reference the function buildExpectedPath and the type CanvasEdgeType and add the throw/assert after the switch to explicitly fail for unhandled cases.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/components/__tests__/canvas-scene-connection.test.tsx around lines 148 - 151, The tests create an Engine instance but call engine.destroy() inline in several tests which can be skipped on assertion failure; declare the engine variable in the outer scope of the describe('CanvasScene connection creation') block, move the engine.destroy() call into the existing afterEach() so it always runs (e.g., if (engine) engine.destroy()), and remove the manual engine.destroy() calls inside the individual tests (the same change should be applied to the other affected tests referenced). Use the existing afterEach hook and the symbol name engine to locate and update the cleanup logic.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/components/canvas-connection-layer-geometry.ts around lines 135 - 137, Replace the local clamp function with the project's shared clamp utility: remove the local function declaration for clamp and import the existing clamp from the shared utility module, then use that imported clamp everywhere this file references clamp (notably the function named clamp in this file). Ensure the import uses the same identifier (clamp) and adjust any call sites if the shared API differs (e.g., parameter order or type signatures) so usages in canvas-connection-layer-geometry.ts remain correct.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/components/canvas-connection-layer-geometry.ts around lines 61 - 77, The renderProps object is allocated unconditionally but only used for straight and step; move its creation so it’s only created when needed: in the switch over edgeType, return buildFreeDragBezierPreviewGeometry(draft.source, draft.current) immediately for the 'bezier' case, and create renderProps inside the 'straight' and 'step' cases before calling buildStraightCanvasEdgeGeometryFromRenderProps(renderProps) and buildStepCanvasEdgeGeometryFromRenderProps(renderProps) respectively (use the existing draft, source/position fields and getOppositePosition as before).

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/components/canvas-connection-layer.tsx at line 33, createNodesById(nodeLookup) is allocating a new Map on every render; wrap that call in a memo so the Map is only recreated when nodeLookup changes and pass the memoized result into buildConnectionDraftGeometry (i.e., memoize the result of createNodesById using React's useMemo with nodeLookup as the dependency, then call buildConnectionDraftGeometry(edgeType, draft, memoizedNodesById) instead of calling createNodesById inline).

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/components/canvas-renderer-utils.ts at line 1, The type PrimitiveArrayValue is currently unexported even though it's used as the generic constraint for the exported areArraysEqual function; export PrimitiveArrayValue so callers can reuse or annotate arrays explicitly. Locate the type alias PrimitiveArrayValue and change its declaration to an exported type (export type PrimitiveArrayValue = ...), ensuring any imports/exports remain consistent with the module's style and that areArraysEqual's signature continues to reference PrimitiveArrayValue.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/components/canvas-scene.tsx around lines 326 - 337, resolveConnectionSnapTarget is being called on every pointermove (inside the pointermove handler that builds nextDraft and sets connectionDraft via connectionDraftRef.current and setConnectionDraft), which currently queries all handles each time and will be slow for large canvases; modify the pointermove handling to avoid calling resolveConnectionSnapTarget on every event by either throttling/debouncing the snap calculation (e.g., only call it at a fixed interval) or caching handle positions/DOM queries and only re-query when nodes move or layout changes, and ensure the pointermove still updates current via screenToCanvasPosition(canvasEngine, paneRef, ...) so that visual feedback remains smooth while snapTarget updates less frequently.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/components/canvas-scene.tsx around lines 122 - 145, The removeEventListener calls can miss the actual registered callbacks because listeners are added with the then-current functions but removed using refs that may have been updated; update the logic so that when you add window listeners you first assign the actual function being registered into connectionPointerUpRef.current and connectionPointerCancelRef.current (i.e., store the registered handler in the ref at registration time) and then always call removeEventListener with those same ref values in handleConnectionPointerUp and handleConnectionPointerCancel; ensure handleConnectionPointerUp and handleConnectionPointerCancel remain stable (or their registration uses the ref snapshot) so add/remove use the identical function reference.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/edges/bezier/bezier-canvas-edge-geometry.ts around lines 138 - 145, The function buildBezierCanvasEdgeGeometryFromRenderProps declares a return type of BezierCurve | null but always returns the result of buildBezierPath which is a BezierCurve; remove the unnecessary "| null" from the function signature to tighten typing (unless you intentionally want parity with buildBezierCanvasEdgeGeometryFromEdge, in which case add a comment explaining that decision); update the return type to BezierCurve and ensure callers/consumers expect a non-null value.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/edges/bezier/bezier-canvas-edge-geometry.ts around lines 76 - 97, The switch on `position` (over `CANVAS_HANDLE_POSITION`) can return undefined for unknown values; add an exhaustive/default branch to fail fast: after the four cases add a `default` that throws an Error (including the unexpected `position` value) or call an `assertUnreachable(position)` helper that types `position` as `never` so TypeScript enforces exhaustiveness; update the function containing this switch (the method where `getControlOffset`, `source`, and `target` are used) to include that default/exhaustiveness check to prevent implicit `undefined` returns and subsequent NaNs.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/edges/shared/canvas-edge-properties.ts around lines 32 - 38, The validateStrokeWidth function currently applies Math.min(lineStrokeSizeCanvasProperty.max, strokeWidth) before calling clampCanvasEdgeStrokeWidth; verify whether clampCanvasEdgeStrokeWidth already enforces the upper bound against lineStrokeSizeCanvasProperty.max. If it does, simplify validateStrokeWidth by passing strokeWidth directly to clampCanvasEdgeStrokeWidth and remove the Math.min call; if it does not, keep the Math.min or move the bound enforcement into clampCanvasEdgeStrokeWidth so that clampCanvasEdgeStrokeWidth(strokeWidth) always guarantees min/max enforcement. Ensure changes reference validateStrokeWidth, clampCanvasEdgeStrokeWidth, and lineStrokeSizeCanvasProperty and add/adjust tests to cover min/max behavior.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/nodes/canvas-node-modules.ts around lines 34 - 37, The import aliases "CanvasNode as Node" and "CanvasPosition as XYPosition" can be removed to avoid shadowing @xyflow/react types; update the import to import the canonical internal types "CanvasNode" and "CanvasPosition" directly and then replace any uses of the aliases "Node" and "XYPosition" in this module (and any exported symbols from canvas-node-modules.ts that reference them) with the full internal names "CanvasNode" and "CanvasPosition" so the code and exports consistently use the canonical internal type names.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/nodes/stroke/__tests__/stroke-node.test.tsx around lines 32 - 34, Move the top-level beforeEach into the test suite's describe block so the strokeEngine is initialized in the same scope as the tests; specifically, cut the beforeEach that calls strokeEngine = createCanvasEngine() and paste it as the first setup call inside the describe(...) that contains the stroke tests so createCanvasEngine() runs with the describe-scoped lifecycle and keeps strokeEngine setup local to those tests.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/runtime/document/use-canvas-commands.ts around lines 225 - 234, The current logic uses "'_reorderPlan' in args" which is true even after setting args._reorderPlan = undefined, so subsequent runs treat an undefined plan as present; change the check to treat undefined/null as absent (e.g. use nullish coalescing or explicit !== undefined) so you compute a new plan when args._reorderPlan is nullish: assign reorderPlan = args._reorderPlan ?? createCanvasReorderPlan(nodesMap, edgesMap, getSelectionSnapshot(args), args.direction) and then either delete args._reorderPlan or set it to null to avoid the stale-in-operator problem; update the code paths around createCanvasReorderPlan and getSelectionSnapshot accordingly.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/system/canvas-dom-registry.ts around lines 59 - 73, The initial measurement uses surfaceElement.getBoundingClientRect() (border-box) but the ResizeObserver callback uses entry.contentRect (content-box), causing jumps; update the logic so both initial and observer updates use the same box model: prefer entry.borderBoxSize when available and compute viewportSurfaceBounds from border-box dimensions, and for the initial measurement either read border-box using getBoundingClientRect() or derive border-box from computed styles (padding/border) so the initial assignment to viewportSurfaceBounds and the ResizeObserver handler (viewportSurfaceBoundsObserver) both use borderBoxSize consistently, falling back to entry.contentRect or getBoundingClientRect() only when necessary.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/components/canvas-read-only-preview.tsx around lines 218 - 262, Extract the hardcoded minWidth={240} and minHeight={180} into named constants (e.g. DEFAULT_EMBED_MIN_WIDTH and DEFAULT_EMBED_MIN_HEIGHT) defined near the top of the file alongside other defaults, then replace the literals in the CanvasPreviewEmbedNode JSX ResizableNodeWrapper props with those constants to keep sizing consistent and configurable.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/edges/shared/__tests__/canvas-edge-geometry.test.ts around lines 1 - 7, Combine the two imports from '~/features/canvas/types/canvas-domain-types' into a single import to clean up the test file: replace the separate imports that bring in CANVAS_HANDLE_POSITION and the type imports (CanvasEdge as Edge, CanvasNode as Node) with one consolidated import statement; locate these in the test file referencing getCanvasEdgeEndpoints and update the import to include CANVAS_HANDLE_POSITION plus the type aliases in one line.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/edges/shared/canvas-edge-style.ts around lines 33 - 34, Clamp the computed opacity to the valid [0, 1] range instead of accepting any numeric parsedStyle.opacity; update the assignment that currently uses parsedStyle.opacity or DEFAULT_CANVAS_EDGE_OPACITY to apply a clamp (e.g., Math.max(0, Math.min(1, value))) or add a small helper like clampCanvasEdgeOpacity and use it here so opacity is always within 0–1 while still defaulting to DEFAULT_CANVAS_EDGE_OPACITY when not a number.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/nodes/embed/__tests__/embedded-canvas-content.test.tsx at line 79, The test "renders a read-only nested canvas preview with nested pan and zoom disabled" claims pan/zoom are disabled but only asserts minZoom/maxZoom/fitPadding; update the test so it matches reality by either renaming the test to reflect only zoom bounds (e.g., "renders a read-only nested canvas preview with correct zoom bounds") or add explicit assertions against the CanvasReadOnlyPreview props that control interactions (check that CanvasReadOnlyPreview receives panOnDrag: false, zoomOnScroll: false and any other interaction flags) so the behavior described in the test name is actually verified.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/nodes/embed/__tests__/embedded-canvas-content.test.tsx at line 52, Replace the assertion that checks absence using .toBeNull() with the idiomatic RTL negative assertion: change the expect call for screen.queryByTestId('embedded-canvas-preview') to use .not.toBeInTheDocument() (in the test in embedded-canvas-content.test.tsx) so the test reads expect(screen.queryByTestId('embedded-canvas-preview')).not.toBeInTheDocument(); this keeps consistency with other RTL assertions and yields clearer failure messages.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/types/canvas-domain-types.ts around lines 59 - 78, CanvasEdge.data is optional while CanvasNode.data is required, creating an inconsistent API; either make CanvasEdge.data required to match CanvasNode (change the CanvasEdge interface so the generic TData and the data property are non-optional) or, if the asymmetry is intentional, add a short explanatory comment above the CanvasEdge declaration documenting why edges may omit data (reference CanvasNode.data and CanvasEdge.data to locate the properties).

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/utils/canvas-fit-view.ts at line 36, The zoom clamp expression using minZoom and maxZoom can behave incorrectly when minZoom > maxZoom; update the logic around the const zoom assignment in canvas-fit-view (referencing minZoom, maxZoom, rawZoom, zoom) to validate the bounds first—either swap minZoom/maxZoom when inverted or throw/log an error and normalize them—then compute zoom with the existing Math.min/Math.max clamp against the validated bounds so inverted inputs no longer force zoom to minZoom unexpectedly.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/components/canvas-node-content-renderer.tsx at line 57, The `as never` cast on the `type` prop hides a real type mismatch between content.type and what the rendered Component expects; remove the `as never` and fix the typing by either updating the generic for CanvasNodeComponentProps (so Component's prop type accepts the actual union/type of content.type) or add a safe type guard/narrowing for content.type before passing it into Component; locate the usage in canvas-node-content-renderer.tsx where `Component` is rendered with `type={content.type as never}`, replace the cast with a correctly typed value (or guarded/narrowed value) and update the CanvasNodeComponentProps generic definitions so the prop types align with content.type.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/components/canvas-node-content-renderer.tsx around lines 33 - 42, The selector passed to useCanvasEngineSelector closes over renderers, fallbackType, and onUnknownNodeType which can change identity each render and break memoization; fix by creating a stable selector function (via useMemo or useCallback) that returns the call to selectCanvasNodeContentSnapshot({ internalNode: snapshot.nodeLookup.get(nodeId), renderers, fallbackType, onUnknownNodeType }) and list renderers/fallbackType/onUnknownNodeType (and nodeId if needed) in its dependency array, then pass that stable selector into useCanvasEngineSelector along with areCanvasNodeContentSnapshotsEqual (update code in CanvasNodeContentRenderer around useCanvasEngineSelector/selectCanvasNodeContentSnapshot to use the memoized selector).

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/components/canvas-node-content-renderer.tsx around lines 87 - 89, The selector currently calls onUnknownNodeType (side effect) inside the selector; change the selector to only return content data (e.g., rawType and isKnownType) without invoking onUnknownNodeType, and in the CanvasNodeContentRenderer component add a useEffect that watches content?.rawType, content?.isKnownType, onUnknownNodeType, and renderers and calls onUnknownNodeType?.(content.rawType, Object.keys(renderers)) only when content.rawType exists and content.isKnownType is false; update references to the selector result (e.g., content or selectContent) accordingly and remove the onUnknownNodeType call from the selector.

- Verify each finding against the current code and only fix it if needed.

In @e2e/canvas-basics.spec.ts around lines 183 - 192, The source text node is closed only by clickCanvasAt while the target uses press('Escape') then clickCanvasAt; make the pattern consistent by adding await textInput.press('Escape') after await textInput.fill('Edge source') (before the existing clickCanvasAt) so both uses of getActiveTextNodeInput/textInput use Escape to close editing, keeping selectCanvasTool, getActiveTextNodeInput, clickCanvasAt, and press('Escape') calls aligned.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/edges/shared/__tests__/canvas-node-map.test.ts around lines 62 - 72, The test for createCanvasNodesById currently asserts logger.warn was called with the skip message but not how many times; update the test around createCanvasNodesById to also assert logger.warn was called twice (e.g., expect(logger.warn).toHaveBeenCalledTimes(2)) so both invalid entries (null and {id: ''}) are verified to produce warnings, referencing the createCanvasNodesById invocation and the logger.warn expectation in the test.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/edges/shared/canvas-node-map.ts around lines 8 - 11, The warning in createCanvasNodesById in canvas-node-map.ts should include the array index for better debugging; update the loop that validates each node to capture the current index (e.g., the index variable from the for/forEach) and include it in the logger.warn message (for example "createCanvasNodesById: skipping invalid node entry at index X"), optionally appending minimal node info (type or id if present) to aid diagnostics while avoiding huge dumps.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/runtime/context-menu/canvas-context-menu-clipboard.ts around lines 6 - 9, Confirm CanvasNode and CanvasEdge are plain-serializable for Yjs by ensuring they contain only JSON-serializable primitives/objects (no class instances, functions, circular refs) before using Y.Map<Node> and Y.Map<Edge> in canvas-context-menu-clipboard.ts; if they aren’t, add conversion helpers (e.g., toSerializable/fromSerializable) and use them wherever you read/write to Y.Map (convert on set and convert back on get) or change stored shape to a minimal serializable DTO; update any uses of CanvasNode/CanvasEdge in this file to call those helpers so Y.Map stores only compatible data.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/runtime/interaction/use-canvas-drop-target.ts at line 5, The import aliases CanvasNode to the generic name Node which is confusing; change the import to use CanvasNode directly (remove "as Node") and update all usages in this module (e.g., the type usage currently referenced as Node around the usage on line 20) to CanvasNode so the file consistently refers to the specific CanvasNode type instead of the generic Node alias.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/runtime/selection/canvas-selection-gesture-controller.ts around lines 260 - 262, The updateState implementation for the lasso gesture is currently creating a new array each call via "points: [...state.points, input.canvasPoint]" which causes O(n²) allocations for long gestures; change it to append into a reusable mutable buffer instead (e.g., maintain a single Array<Point> within the gesture strategy and call state.points.push(input.canvasPoint) or push into that buffer inside updateState) and only create a defensive copy when the state is exposed outside the strategy; ensure references to updateState, state.points, and input.canvasPoint are updated and verify no other code assumes immutable points arrays before switching to the mutable approach.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/system/__tests__/canvas-engine.test.ts around lines 381 - 404, This test registers DOM elements via engine.registerViewportElement(viewportElement) and engine.registerNodeElement('measured', measuredElement) but never calls their unregister functions, causing leaked registrations; capture the return values from registerViewportElement and registerNodeElement (they return unregister callbacks) and call those unregister callbacks (or call any provided unregisterViewportElement/unregisterNodeElement methods) before calling engine.destroy() to clean up the registered viewport and node elements.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/system/__tests__/canvas-engine.test.ts around lines 357 - 379, The test registers a viewport with engine.registerViewportElement(viewportElement) but doesn't store or call the returned unregister function; update the test to capture the unregister function (e.g., const unregisterViewport = engine.registerViewportElement(viewportElement)) and call unregisterViewport() before engine.destroy() so the viewport registration is cleaned up explicitly, matching the pattern used elsewhere in this test file.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/system/__tests__/canvas-engine.test.ts around lines 425 - 460, The test registers elements via registerViewportElement, registerNodeElement('source'), registerNodeElement('target'), and registerEdgeElement('edge-1') but never calls the returned unregister functions before engine.destroy(); capture each registration's return value (the unregister callbacks) when calling registerViewportElement, registerNodeElement, and registerEdgeElement, and invoke those unregister functions (or call a single cleanup function if provided) before calling engine.destroy() so the test cleans up registered DOM listeners/elements properly.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/tools/select/__tests__/select-tool-spec.test.tsx around lines 100 - 101, Update the test description that still mentions "strict toggle behavior" to use the new parameter name/terminology: refer to "additive selection" (true = additive/keep existing selections, false = replacement) so it matches the renamed parameter used by toggleNode and toggleEdge; locate the test description string near the top of select-tool-spec.test.tsx and replace wording accordingly to reflect additive selection semantics.

- Verify each finding against the current code and only fix it if needed.

In @src/features/canvas/tools/shared/__tests__/placement-tool-test-utils.ts at line 6, The import aliases the domain type as "Node" (import type { CanvasNode as Node }) which reduces clarity; remove the alias and import the type as "CanvasNode" (import type { CanvasNode }) and then replace every usage of the alias "Node" in this test file (e.g., type annotations, variables, helper functions) with the explicit "CanvasNode" identifier so the domain type is explicit throughout (search for "Node" references in placement-tool-test-utils.ts and switch them to "CanvasNode").

- Verify each finding against the current code and only fix it if needed.

In @src/features/editor/components/viewer/history-preview-viewer.tsx around lines 13 - 16, Replace the aliasing of CanvasEdge and CanvasNode to Edge and Node in the import and use the original names to avoid shadowing; update the import to import CanvasEdge and CanvasNode (instead of Edge/Node) and then update usages in CanvasSnapshotPreview (e.g., the doc.getMap generics nodesMap/edgesMap and return types like nodes: Array<CanvasNode> and edges: Array<CanvasEdge>) so all types explicitly reference CanvasNode and CanvasEdge.