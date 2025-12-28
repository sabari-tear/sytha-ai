import {NextRequest,NextResponse} from "next/server";
import {embedTexts} from "@/lib/embeddings";
import {setUserDocuments} from "@/lib/documentStore";

export async function POST(request:NextRequest){
  try{
    const formData=await request.formData();
    const files=formData.getAll("files") as File[];
    const userId=formData.get("userId") as string;
    const type=formData.get("type") as string;

    if(!files.length||!userId||!type){
      return NextResponse.json({error:"Files,userId,type required"},{status:400});
    }

    const processedDocuments=[];

    for(const file of files){
      const text=await file.text();
      const chunks=splitTextIntoChunks(text,1000);
      const embeddings=await embedTexts(chunks);

      for(let i=0;i<chunks.length;i++){
        processedDocuments.push({
          fileName:file.name,
          content:chunks[i],
          embedding:embeddings[i],
          chunkIndex:i,
          totalChunks:chunks.length
        });
      }
    }

    setUserDocuments(userId,type,processedDocuments);

    return NextResponse.json({
      success:true,
      documentsProcessed:files.length,
      totalChunks:processedDocuments.length
    });
  }catch(e){
    return NextResponse.json({error:"Failed to process documents"},{status:500});
  }
}

function splitTextIntoChunks(text:string,chunkSize:number){
  const words=text.split(/\s+/);
  const chunks=[];
  for(let i=0;i<words.length;i+=chunkSize){
    const chunk=words.slice(i,i+chunkSize).join(" ");
    if(chunk.trim())chunks.push(chunk);
  }
  return chunks;
}
