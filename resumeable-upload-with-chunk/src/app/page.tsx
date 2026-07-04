import FileGallery from "@/components/file-gallery";
import FileUpload from "@/components/file-upload";

export default function Home() {
  return (
    <div className="lg:p-24 p-4">
      <FileUpload />
      <div className="mt-2">
        <FileGallery />
      </div>
    </div>
  );
}
