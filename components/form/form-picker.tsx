"use client";

import { useEffect, useState, useRef } from "react";
import { unsplash } from "@/lib/unsplash";
import { Check, Loader2, Upload } from "lucide-react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { defaultImages } from "@/constants/images";
import Link from "next/link";
import { FormErrors } from "./form-errors";
import { Button } from "@/components/ui/button";

interface FormPickerProps {
  id: string;
  errors?: Record<string, string[] | undefined>;
}

export const FormPicker = ({ id, errors }: FormPickerProps) => {
  const { pending } = useFormStatus();
  const [images, setImages] = useState<Array<{
    id: string;
    urls: { thumb: string; full: string };
    links: { html: string };
    user: { name: string };
  }>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const result = await unsplash.photos.getRandom({
          collectionIds: ["317099"],
          count: 9,
        });

        if (result && result.response) {
          const newImages = result.response as Array<{
            id: string;
            urls: { thumb: string; full: string };
            links: { html: string };
            user: { name: string };
          }>;
          setImages(newImages);
        } else {
          console.error("Failed to fetch images from Unsplash");
        }
      } catch (error) {
        console.log({ error });
        setImages(defaultImages);
      } finally {
        setIsLoading(false);
      }
    };

    fetchImages();
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setUploadedImage(dataUrl);
      setSelectedImageId('uploaded');
    };
    reader.readAsDataURL(file);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 text-sky-700 animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="mb-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => fileInputRef.current?.click()}
          disabled={pending}
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload your own image
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>
      
      {uploadedImage && (
        <div className="mb-2">
          <div
            className={cn(
              "cursor-pointer relative aspect-video group hover:opacity-75 transition bg-muted w-full",
              pending && "opacity-50 hover:opacity-50 cursor-auto",
            )}
            onClick={() => {
              if (pending) return;
              setSelectedImageId('uploaded');
            }}
          >
            <input
              id={`${id}-uploaded`}
              type="radio"
              name={id}
              className="hidden"
              checked={selectedImageId === 'uploaded'}
              disabled={pending}
              value={`uploaded|${uploadedImage}|${uploadedImage}||Custom Upload`}
            />
            <Image
              src={uploadedImage}
              alt="Uploaded image"
              className="object-cover rounded-sm"
              fill
            />
            {selectedImageId === 'uploaded' && (
              <div className="absolute inset-y-0 h-full w-full bg-black/30 flex items-center justify-center">
                <Check className="h-4 w-4 text-white" />
              </div>
            )}
            <div className="opacity-0 group-hover:opacity-100 absolute bottom-0 w-full text-[10px] truncate text-white p-1 bg-black/50">
              Your uploaded image
            </div>
          </div>
        </div>
      )}
      
      <div className="text-xs text-neutral-500 mb-2 text-center">
        Or choose from Unsplash
      </div>
      
      <div className="grid grid-cols-3 gap-2 mb-2">
        {images.map((image) => (
          <div
            key={image.id}
            className={cn(
              "cursor-pointer relative aspect-video group hover:opacity-75 transition bg-muted",
              pending && "opacity-50 hover:opacity-50 cursor-auto",
            )}
            onClick={() => {
              if (pending) return;
              setSelectedImageId(image.id);
            }}
          >
            <input
              id={id}
              type="radio"
              name={id}
              className="hidden"
              checked={selectedImageId === image.id}
              disabled={pending}
              value={`${image.id}|${image.urls.thumb}|${image.urls.full}|${image.links.html}|${image.user.name}`}
            />
            <Image
              src={image.urls.thumb}
              alt="Unpslash image"
              className="object-cover rounded-sm"
              fill
            />
            {selectedImageId === image.id && (
              <div className="absolute inset-y-0 h-full w-full bg-black/30 flex items-center justify-center">
                <Check className="h-4 w-4 text-white" />
              </div>
            )}
            <Link
              href={image.links.html}
              target="_blank"
              className="opacity-0 group-hover:opacity-100 absolute bottom-0 w-full text-[10px] truncate text-white hover:underline p-1 bg-black/50"
            >
              {image.user.name}
            </Link>
          </div>
        ))}
      </div>
      <FormErrors id="image" errors={errors} />
    </div>
  );
};
