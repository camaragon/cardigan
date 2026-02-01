"use client";

import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { LABEL_COLORS } from "@/constants/labels";
import { useAction } from "@/hooks/use-action";
import { createLabel } from "@/actions/create-label";
import { updateLabel } from "@/actions/update-label";
import { deleteLabel } from "@/actions/delete-label";
import { assignLabel } from "@/actions/assign-label";
import { unassignLabel } from "@/actions/unassign-label";
import { fetcher } from "@/lib/fetcher";
import { Label } from "@prisma/client";
import { CardLabel } from "@prisma/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface LabelPickerProps {
  children: React.ReactNode;
  cardId: string;
  assignedLabels: (CardLabel & { label: Label })[];
}

export const LabelPicker = ({
  children,
  cardId,
  assignedLabels,
}: LabelPickerProps) => {
  const params = useParams();
  const boardId = params.boardId as string;
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [editingLabel, setEditingLabel] = useState<Label | null>(null);
  const [newName, setNewName] = useState("");
  const [selectedColor, setSelectedColor] = useState(LABEL_COLORS[0].value);

  const { data: orgLabels } = useQuery<Label[]>({
    queryKey: ["labels"],
    queryFn: () => fetcher("/api/labels"),
  });

  const assignedLabelIds = useMemo(
    () => new Set(assignedLabels.map((cl) => cl.label.id)),
    [assignedLabels],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["card", cardId] });
    queryClient.invalidateQueries({ queryKey: ["labels"] });
  };

  const { execute: executeCreate, isLoading: isCreatingLabel } = useAction(
    createLabel,
    {
      onSuccess: (label) => {
        toast.success(`Label "${label.name}" created`);
        setIsCreating(false);
        setNewName("");
        invalidate();
      },
      onError: (error) => toast.error(error),
    },
  );

  const { execute: executeUpdate, isLoading: isUpdatingLabel } = useAction(
    updateLabel,
    {
      onSuccess: (label) => {
        toast.success(`Label "${label.name}" updated`);
        setEditingLabel(null);
        setNewName("");
        invalidate();
      },
      onError: (error) => toast.error(error),
    },
  );

  const { execute: executeDelete } = useAction(deleteLabel, {
    onSuccess: () => {
      toast.success("Label deleted");
      setEditingLabel(null);
      setNewName("");
      invalidate();
    },
    onError: (error) => toast.error(error),
  });

  const { execute: executeAssign } = useAction(assignLabel, {
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(error),
  });

  const { execute: executeUnassign } = useAction(unassignLabel, {
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(error),
  });

  const onToggleLabel = (labelId: string) => {
    if (assignedLabelIds.has(labelId)) {
      executeUnassign({ cardId, labelId, boardId });
    } else {
      executeAssign({ cardId, labelId, boardId });
    }
  };

  const onCreateLabel = () => {
    if (!newName.trim()) return;
    executeCreate({ name: newName.trim(), color: selectedColor, boardId });
  };

  const onEditLabel = (label: Label) => {
    setEditingLabel(label);
    setNewName(label.name);
    setSelectedColor(label.color);
    setIsCreating(false);
  };

  const onSaveEdit = () => {
    if (!editingLabel || !newName.trim()) return;
    executeUpdate({
      id: editingLabel.id,
      name: newName.trim(),
      color: selectedColor,
      boardId,
    });
  };

  const onDeleteLabel = () => {
    if (!editingLabel) return;
    executeDelete({ id: editingLabel.id, boardId });
  };

  const onCancelEdit = () => {
    setEditingLabel(null);
    setNewName("");
    setSelectedColor(LABEL_COLORS[0].value);
  };

  const showingForm = isCreating || editingLabel;

  const onOpenChange = (open: boolean) => {
    if (open) {
      setIsCreating(false);
      setEditingLabel(null);
      setNewName("");
      setSelectedColor(LABEL_COLORS[0].value);
    }
  };

  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72 p-3" side="bottom" align="start">
        <div className="text-sm font-medium text-center text-neutral-600 pb-3">
          {editingLabel ? "Edit label" : "Labels"}
        </div>
        <PopoverClose asChild>
          <Button
            className="h-auto w-auto p-2 absolute top-2 right-2 text-neutral-600"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        </PopoverClose>

        {!showingForm && (
          <>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {orgLabels?.length === 0 && (
              <p className="text-xs text-neutral-500 text-center py-2">No labels yet</p>
            )}
            {orgLabels?.map((label) => (
                <div
                  key={label.id}
                  className="flex items-center gap-1 p-1 rounded-sm hover:bg-neutral-100"
                >
                  <button
                    onClick={() => onToggleLabel(label.id)}
                    className="flex-1 flex items-center gap-2"
                    aria-pressed={assignedLabelIds.has(label.id)}
                  >
                    <div
                      className="h-8 flex-1 rounded-sm flex items-center px-2"
                      style={{ backgroundColor: label.color }}
                    >
                      <span className="text-xs font-medium text-white truncate">
                        {label.name}
                      </span>
                    </div>
                    {assignedLabelIds.has(label.id) && (
                      <Check className="h-4 w-4 text-neutral-700 shrink-0" />
                    )}
                  </button>
                  <button
                    onClick={() => onEditLabel(label)}
                    className="p-1 rounded-sm hover:bg-neutral-200 shrink-0"
                    aria-label={`Edit ${label.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5 text-neutral-500" />
                  </button>
                </div>
              ))}
            </div>

            <Button
              onClick={() => {
                setIsCreating(true);
                setNewName("");
                setSelectedColor(LABEL_COLORS[0].value);
              }}
              variant="ghost"
              className="w-full mt-2 text-sm"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Create a new label
            </Button>
          </>
        )}

        {showingForm && (
          <div className="space-y-2">
            {/* Preview */}
            <div
              className="h-9 rounded-sm flex items-center px-3"
              style={{ backgroundColor: selectedColor }}
            >
              <span className="text-sm font-medium text-white truncate">
                {newName || (editingLabel ? editingLabel.name : "Preview")}
              </span>
            </div>

            <label htmlFor="label-name" className="sr-only">Label name</label>
            <input
              id="label-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Label name..."
              autoComplete="off"
              className="w-full text-sm border rounded-sm px-2 py-1.5 outline-none focus:ring-1 focus:ring-sky-600"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  editingLabel ? onSaveEdit() : onCreateLabel();
                }
              }}
            />

            <div className="flex flex-wrap gap-1">
              {LABEL_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setSelectedColor(color.value)}
                  className="h-7 w-7 rounded-sm relative"
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                  aria-label={color.name}
                  aria-pressed={selectedColor === color.value}
                >
                  {selectedColor === color.value && (
                    <Check className="h-3.5 w-3.5 text-white absolute inset-0 m-auto" />
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {editingLabel ? (
                <>
                  <Button
                    onClick={onSaveEdit}
                    disabled={!newName.trim() || isUpdatingLabel}
                    size="sm"
                    className="text-xs"
                  >
                    Save
                  </Button>
                  <Button
                    onClick={onCancelEdit}
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={onDeleteLabel}
                    variant="ghost"
                    size="sm"
                    className="text-xs ml-auto text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={onCreateLabel}
                    disabled={!newName.trim() || isCreatingLabel}
                    size="sm"
                    className="text-xs"
                  >
                    Create
                  </Button>
                  <Button
                    onClick={() => {
                      setIsCreating(false);
                      setNewName("");
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
