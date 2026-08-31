"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { SmartFieldPicker } from "@/components/emails/SmartFieldPicker";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Image as ImageIcon,
  Baseline,
} from "lucide-react";

interface EmailBodyEditorProps {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
}

/**
 * Rich text editor tuned for email bodies. Supports bold/italic/underline,
 * font color, text alignment, inline images (by URL), external hyperlinks and
 * a smart-field picker that inserts {{tokens}} at the cursor.
 *
 * The toolbar is icon-based and wraps on small screens (condensed mobile).
 */
export function EmailBodyEditor({
  content,
  onChange,
  editable = true,
}: EmailBodyEditorProps) {
  const colorInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
    ],
    content,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  const btn = (active: boolean) =>
    `h-8 w-8 p-0 ${active ? "bg-accent" : ""}`;

  const addImage = () => {
    const url = window.prompt("Image URL");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev || "https://");
    if (url === null) return; // cancelled
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  };

  const insertToken = (token: string) => {
    editor.chain().focus().insertContent(token).run();
  };

  return (
    <div className="space-y-2">
      {editable && (
        <div className="flex flex-wrap items-center gap-1 rounded-md border border-input bg-background p-1">
          <Button variant="ghost" size="sm" type="button" className={btn(editor.isActive("heading", { level: 2 }))}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading">
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" type="button" className={btn(editor.isActive("heading", { level: 3 }))}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Subheading">
            <Heading3 className="h-4 w-4" />
          </Button>
          <div className="mx-0.5 w-px self-stretch bg-border" />
          <Button variant="ghost" size="sm" type="button" className={btn(editor.isActive("bold"))}
            onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
            <Bold className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" type="button" className={btn(editor.isActive("italic"))}
            onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
            <Italic className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" type="button" className={btn(editor.isActive("underline"))}
            onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
            <UnderlineIcon className="h-4 w-4" />
          </Button>

          {/* Font color */}
          <div className="relative">
            <Button variant="ghost" size="sm" type="button" className="h-8 w-8 p-0"
              onClick={() => colorInputRef.current?.click()} title="Text color">
              <Baseline className="h-4 w-4" style={{ color: (editor.getAttributes("textStyle").color as string) || undefined }} />
            </Button>
            <input
              ref={colorInputRef}
              type="color"
              className="absolute left-0 top-0 h-0 w-0 opacity-0"
              value={(editor.getAttributes("textStyle").color as string) || "#000000"}
              onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            />
          </div>

          <div className="mx-0.5 w-px self-stretch bg-border" />
          <Button variant="ghost" size="sm" type="button" className={btn(editor.isActive("bulletList"))}
            onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
            <List className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" type="button" className={btn(editor.isActive("orderedList"))}
            onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">
            <ListOrdered className="h-4 w-4" />
          </Button>
          <div className="mx-0.5 w-px self-stretch bg-border" />
          <Button variant="ghost" size="sm" type="button" className={btn(editor.isActive({ textAlign: "left" }))}
            onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Align left">
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" type="button" className={btn(editor.isActive({ textAlign: "center" }))}
            onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Align center">
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" type="button" className={btn(editor.isActive({ textAlign: "right" }))}
            onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Align right">
            <AlignRight className="h-4 w-4" />
          </Button>
          <div className="mx-0.5 w-px self-stretch bg-border" />
          <Button variant="ghost" size="sm" type="button" className={btn(editor.isActive("link"))}
            onClick={setLink} title="Insert link">
            <LinkIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" type="button" className="h-8 w-8 p-0"
            onClick={addImage} title="Insert image">
            <ImageIcon className="h-4 w-4" />
          </Button>
          <div className="mx-0.5 w-px self-stretch bg-border" />
          <SmartFieldPicker compact onInsert={(token) => insertToken(token)} />
        </div>
      )}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none rounded-md border border-input bg-background px-4 py-3 dark:prose-invert [&_a]:text-primary [&_a]:underline [&_img]:rounded-md"
      />
    </div>
  );
}
