import { h } from "preact";
import { useState, useEffect } from "preact/hooks";
import { Blog } from "@models/Blog";

interface SearchBoxProps {
  entries: Blog[];
  onSearchResults: (results: Blog[], term: string) => void;
  initialSearchTerm?: string;
}

export default function SearchBox({ entries, onSearchResults, initialSearchTerm = "" }: SearchBoxProps) {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  
  // Function to perform search
  const performSearch = (term: string) => {
    if (term.trim() === "") {
      // If search is empty, return all entries
      onSearchResults(entries, term);
      return;
    }
    
    const lowerCaseTerm = term.toLowerCase();
    
    // Filter entries based on search term
    const results = entries.filter((entry) => {
      const titleMatch = entry.data.title.toLowerCase().includes(lowerCaseTerm);
      const abstractMatch = entry.data.abstract?.toLowerCase().includes(lowerCaseTerm) || false;
      const contentMatch = entry.content ? entry.content.toLowerCase().includes(lowerCaseTerm) : false;
      
      return titleMatch || abstractMatch || contentMatch;
    });
    
    // Log for debugging
    console.log(`Search term: "${term}", Results: ${results.length}`);
    
    onSearchResults(results, term);
  };
  
  // Update search results when search term changes
  useEffect(() => {
    performSearch(searchTerm);
  }, [searchTerm, entries]);
  
  // Update search term when initialSearchTerm changes
  useEffect(() => {
    setSearchTerm(initialSearchTerm);
  }, [initialSearchTerm]);
  
  // Handle input change
  const handleInputChange = (e: Event) => {
    const newTerm = (e.target as HTMLInputElement).value;
    setSearchTerm(newTerm);
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