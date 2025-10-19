import { Dialog } from "@headlessui/react";

interface ImageEditModalProps {
  isModalOpen: boolean;
  setIsModalOpen: (v: boolean) => void;
  editPrompt: string;
  setEditPrompt: (v: string) => void;
  handleRegenerate: () => void;
  regenLoading: boolean;
}

export const ImageEditModal = ({
  isModalOpen,
  setIsModalOpen,
  editPrompt,
  setEditPrompt,
  handleRegenerate,
  regenLoading,
}: ImageEditModalProps) => {
  return (
    <Dialog
      open={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    >
      <Dialog.Panel className="bg-white p-6 rounded-lg shadow-md w-96">
        <Dialog.Title className="font-semibold text-lg mb-2">
          Edit & Generate Frame
        </Dialog.Title>
        <textarea
          value={editPrompt}
          onChange={(e) => setEditPrompt(e.target.value)}
          rows={6}
          className="w-full border rounded p-2 text-sm text-black"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => setIsModalOpen(false)}
            className="px-4 py-2 border rounded text-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleRegenerate}
            disabled={regenLoading}
            className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 disabled:opacity-60"
          >
            {regenLoading ? "Regenerating..." : "Regenerate"}
          </button>
        </div>
      </Dialog.Panel>
    </Dialog>
  );
};
