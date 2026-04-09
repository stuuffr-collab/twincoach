import { NextResponse } from "next/server";
import seedPack from "../../../../../../content/seed_ready_content_fixture_pack_ca05_v1.json";

export async function GET() {
  return NextResponse.json(seedPack.activeUnits);
}
