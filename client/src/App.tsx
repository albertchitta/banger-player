import { useEffect, useState } from "react";
import axios from "axios";

function App() {
  const [data, setData] = useState<string[]>([]);

  const fetchAPI = async () => {
    const response = await axios.get("http://localhost:5000/members");
    console.log(response.data.members);
    setData(response.data.members);
  };

  useEffect(() => {
    fetchAPI();
  }, []);

  return (
    <div>
      {typeof data === "undefined" ? (
        <p>Loading...</p>
      ) : (
        data.map((member, index) => <p key={index}>{member}</p>)
      )}
    </div>
  );
}

export default App;
