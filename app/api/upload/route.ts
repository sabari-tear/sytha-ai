import { NextRequest, NextResponse } from "next/server";
import { chunkFileText, uploadDocumentsToPinecone } from "@/lib/upload";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.PINECONE_API_KEY;
    const indexName = process.env.PINECONE_INDEX;

    if (!apiKey || !indexName) {
      return NextResponse.json(
        { ok: false, error: "Pinecone is not configured. Please set PINECONE_API_KEY and PINECONE_INDEX." },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const fileEntries = formData.getAll("files");

    const files = fileEntries.filter((entry): entry is File => entry instanceof File);
    if (!files.length) {
      return NextResponse.json(
        { ok: false, error: "No files provided. Please attach at least one file under the 'files' field." },
        { status: 400 },
      );
    }

    let allDocs: any[] = [];
    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const rawText = Buffer.from(arrayBuffer).toString("utf8");
      const docs = chunkFileText(file.name, rawText);
      allDocs = allDocs.concat(docs);
    }

    const { uploadedChunks } = await uploadDocumentsToPinecone(allDocs);

    return NextResponse.json(
      {
        ok: true,
        fileCount: files.length,
        uploadedChunks,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error("/api/upload error", error);
    return NextResponse.json(
      { ok: false, error: "Failed to upload documents to Pinecone." },
      { status: 500 },
    );
  }
}
