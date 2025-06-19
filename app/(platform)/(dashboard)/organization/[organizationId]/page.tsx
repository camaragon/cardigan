import { db } from "@/lib/db";
import { Board } from "./board";
import { Form } from "./form";

const OrganizationIdPage = async () => {
  const boards = await db.board.findMany();

  return (
    <div className="flex flex-col space-y-4">
      <Form />
      {boards.map((board) => (
        <Board key={board.id} title={board.title} id={board.id} />
      ))}
    </div>
  );
};

export default OrganizationIdPage;
