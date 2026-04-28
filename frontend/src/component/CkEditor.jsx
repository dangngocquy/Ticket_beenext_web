import React, { useEffect, useRef } from 'react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';

const CkInput = ({ name, form, setPreviewData, initialValue = "", resetKey, placeholder = "" }) => {
  const editorRef = useRef(null);
  const instanceRef = useRef(null);

  const htmlToText = (html) => {
    if (!html) return "";
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{2,}/g, "\n")
      .trim();
  };

  const cleanEditorHtml = (html) => {
    if (!html) return "";
    const container = document.createElement("div");
    container.innerHTML = html;

    container.querySelectorAll('[data-cke-filler]').forEach((n) => n.remove());
    container.querySelectorAll('p').forEach((p) => {
      const inner = p.innerHTML.replace(/&nbsp;/g, '').replace(/<br\s*\/?\s*>/gi, '').trim();
      if (!inner) {
        p.remove();
      } else {
        p.innerHTML = p.innerHTML.replace(/^(?:\s|&nbsp;|<br\s*\/?\s*>)+/i, '').replace(/(?:\s|&nbsp;|<br\s*\/?\s*>)+$/i, '');
      }
    });

    while (container.firstChild && container.firstChild.nodeName === 'BR') container.removeChild(container.firstChild);
    while (container.lastChild && container.lastChild.nodeName === 'BR') container.removeChild(container.lastChild);

    container.innerHTML = container.innerHTML.replace(/(<br\s*\/?\s*>\s*){2,}/gi, '<br/>');

    if (container.childNodes.length === 1) {
      const only = container.firstChild;
      if (only.nodeName === 'P' && only.childNodes.length === 1 && only.firstChild.nodeType === Node.TEXT_NODE) {
        return only.textContent.trim();
      }
    }

    return container.innerHTML.trim();
  };

  const escapeHtml = (unsafe) => {
    return String(unsafe)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  useEffect(() => {
    const initEditor = async () => {
      if (!editorRef.current) return;

      let dataInit = initialValue || "";
      const looksLikeHtml = /<[^>]+>/.test(dataInit);
      const isKetQua = name === "ketQua" || name === "edit_ketQua";
      const htmlInit = dataInit
        ? (looksLikeHtml ? dataInit : `<p>${escapeHtml(dataInit)}</p>`)
        : (isKetQua ? "<p>Đã hoàn thành</p>" : "<p></p>");

      if (instanceRef.current) {
        instanceRef.current.setData(htmlInit);
        const cleanedHtml = cleanEditorHtml(htmlInit);
        const plainText = htmlToText(cleanedHtml);
        form?.setFieldsValue({ [name]: plainText, [`${name}Html`]: cleanedHtml });
        setPreviewData?.((prev) => ({
          ...prev,
          [name]: plainText,
          [`${name}Html`]: cleanedHtml,
        }));
        return;
      }

      try {
        const editor = await ClassicEditor.create(editorRef.current, {
          initialData: htmlInit,
          toolbar: {
            items: ["bold", "italic", "numberedList", "bulletedList", "undo", "redo"],
            shouldNotGroupWhenFull: true,
          },
          removePlugins: ["Title"],
          placeholder: placeholder || "",
          licenseKey: "",
        });

        instanceRef.current = editor;

        if (!window.ckEditorInstances) {
          window.ckEditorInstances = {};
        }
        window.ckEditorInstances[name] = editor;

        const initialHtml = editor.getData();
        const cleanedHtml = cleanEditorHtml(initialHtml);
        const initialPlain = htmlToText(cleanedHtml);
        
        form?.setFieldsValue({ [name]: initialPlain, [`${name}Html`]: cleanedHtml });
        setPreviewData?.((prev) => ({
          ...prev,
          [name]: initialPlain,
          [`${name}Html`]: cleanedHtml,
        }));

        editor.model.document.on("change:data", () => {
          const value = editor.getData();
          const cleanedValue = cleanEditorHtml(value);
          const plain = htmlToText(cleanedValue);
          form?.setFieldsValue({ [name]: plain, [`${name}Html`]: cleanedValue });
          setPreviewData?.((prev) => ({
            ...prev,
            [name]: plain,
            [`${name}Html`]: cleanedValue,
          }));
        });
      } catch (err) {
        console.error("CKEditor init failed", err);
      }
    };

    initEditor();

    return () => {
      if (instanceRef.current) {
        instanceRef.current.destroy().catch(() => {});
        instanceRef.current = null;
      }
    };
  }, [name, form, setPreviewData, initialValue, placeholder]);

  useEffect(() => {
    if (instanceRef.current && resetKey !== undefined) {
      const isKetQua = name === "ketQua" || name === "edit_ketQua";
      const defaultText = isKetQua ? "Đã hoàn thành" : "";
      const htmlText = defaultText ? `<p>${escapeHtml(defaultText)}</p>` : "<p></p>";
      instanceRef.current.setData(htmlText);

      const cleanedHtml = cleanEditorHtml(htmlText);
      form?.setFieldsValue({ [name]: defaultText, [`${name}Html`]: cleanedHtml });
      setPreviewData?.((prev) => ({
        ...prev,
        [name]: defaultText,
        [`${name}Html`]: cleanedHtml,
      }));
    }
  }, [resetKey, name, form, setPreviewData]);

  return (
    <div className="ant-form-item-control-input editor-box">
      <div
        ref={editorRef}
        style={{ minHeight: 140, border: "1px solid #d9d9d9", borderRadius: 6, padding: 8, width: "100%" }}
      ></div>
    </div>
  );
};

export default CkInput;
