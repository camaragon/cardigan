"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

export type State = {
  errors?: {
    title?: string[];
  };
  message?: string | null;
};

const CreateBoard = z.object({
  title: z
    .string()
    .min(3, { message: "Minimum length of 3 letters is required" }),
});

export const create = async (prevState: State, formData: FormData) => {
  const validatedFields = CreateBoard.safeParse({
    title: formData.get("title"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Missing fields",
    };
  }

  const { title } = validatedFields.data;

  try {
    await db.board.create({
      data: {
        title,
      },
    });
  } catch (error) {
    return {
      message: `Database error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  revalidatePath("/organization/org_2y0VJexbwimzZMOTwEwbn2dZcaK");
  redirect("/organization/org_2y0VJexbwimzZMOTwEwbn2dZcaK");
};
