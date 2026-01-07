/**
 * Footer component for mention menu displaying helpful keyboard shortcuts
 * Similar to Obsidian's linking menu footer
 */
export function MentionMenuFooter() {
  return (
    <div className="mention-menu-footer">
      <div className="mention-menu-footer-content">
        <div>Type # to link heading</div>
        <div>Type | to change display text</div>
      </div>
    </div>
  )
}
