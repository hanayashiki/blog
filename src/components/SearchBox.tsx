import { h } from "preact";
import { useState, useEffect } from "preact/hooks";

interface SearchBoxProps {
  onSearch: (term: string) => void;
  initialSearchTerm?: string;
}

export default function SearchBox({ onSearch, initialSearchTerm = "" }: SearchBoxProps) {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  
  // Update search term when initialSearchTerm changes
  useEffect(() => {
    setSearchTerm(initialSearchTerm);
  }, [initialSearchTerm]);
  
  // Handle input change
  const handleInputChange = (e: Event) => {
    const newTerm = (e.target as HTMLInputElement).value;
    setSearchTerm(newTerm);
    onSearch(newTerm);
  };
  
  return (
    <div class="mb-6 mt-4">
      <input
        type="text"
        placeholder="Search blogs..."
        value={searchTerm}
        onInput={handleInputChange}
        class="w-full px-4 py-2 rounded-md bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
      />
    </div>
  );
}